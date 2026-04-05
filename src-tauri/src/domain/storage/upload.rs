use serde::{Deserialize, Serialize};

/// 上传媒体类型。
///
/// 设计意图（给新手）：
/// 1. 媒体类型是业务语义，不应该散落在字符串常量里；
/// 2. 后续新增类型（例如 `document`）时，只需要扩展这个枚举并同步校验规则；
/// 3. 前端拿到这个类型后，可以稳定地做 `if/else` 或 `switch` 渲染分支。
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum UploadMediaType {
    Image,
    Video,
    Audio,
}

/// 上传结果实际采用的存储策略。
///
/// 当前策略：
/// - `qiniu`: 已配置七牛，文件上传到云端并返回可访问 URL；
/// - `base64`: 未配置七牛时，只有图片允许使用 Base64 内联。
///
/// 扩展建议：
/// - 后续新增云存储（如 S3、OSS）时，可在这里新增枚举成员；
/// - application 层通过 `match` 分发策略，避免在 UI 层堆 `if/else`。
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum UploadStorageProvider {
    Qiniu,
    Base64,
}

/// 上传能力输入 DTO（由 command 层接收后传入 application 层）。
///
/// 注意：
/// - 这里是“后端函数调用契约”，不是 HTTP DTO；
/// - Tauri command 收到参数后，会构造成该结构体交给用例处理。
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UploadAssetRequest {
    pub node_id: String,
    pub file_name: String,
    pub mime_type: String,
    pub file_bytes: Vec<u8>,
}

/// 上传能力输出 DTO（直接返回给前端节点卡片使用）。
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UploadedAsset {
    pub id: String,
    pub name: String,
    pub mime_type: String,
    pub size_in_bytes: usize,
    pub preview_url: String,
    pub media_type: UploadMediaType,
    pub storage_provider: UploadStorageProvider,
    pub object_key: Option<String>,
}

/// 通过文件扩展名识别媒体类型（领域规则：白名单）。
pub fn detect_media_type_by_extension(file_name: &str) -> Result<UploadMediaType, String> {
    let extension = file_name
        .rsplit('.')
        .next()
        .unwrap_or_default()
        .trim()
        .to_ascii_lowercase();

    if extension.is_empty() || extension == file_name.trim().to_ascii_lowercase() {
        return Err("文件名缺少扩展名，无法判断格式。".to_string());
    }

    if is_supported_image_extension(&extension) {
        return Ok(UploadMediaType::Image);
    }

    if is_supported_video_extension(&extension) {
        return Ok(UploadMediaType::Video);
    }

    if is_supported_audio_extension(&extension) {
        return Ok(UploadMediaType::Audio);
    }

    Err(
        "仅支持以下格式：音频 wav/mp3，图片 jpeg/jpg/png(无透明通道)/bmp/webp，视频 mp4/mov。"
            .to_string(),
    )
}

/// 给 Base64 回填和上传元数据使用的标准 MIME。
///
/// 说明：
/// - 某些浏览器对 `file.type` 填充不稳定，后端应以扩展名兜底；
/// - 返回值统一小写，便于前端稳定比较。
pub fn normalize_mime_type(file_name: &str, provided_mime_type: &str) -> String {
    let normalized_from_input = provided_mime_type.trim().to_ascii_lowercase();
    if !normalized_from_input.is_empty() {
        return normalized_from_input;
    }

    let extension = file_name
        .rsplit('.')
        .next()
        .unwrap_or_default()
        .trim()
        .to_ascii_lowercase();

    match extension.as_str() {
        "jpeg" | "jpg" => "image/jpeg".to_string(),
        "png" => "image/png".to_string(),
        "bmp" => "image/bmp".to_string(),
        "webp" => "image/webp".to_string(),
        "wav" => "audio/wav".to_string(),
        "mp3" => "audio/mpeg".to_string(),
        "mp4" => "video/mp4".to_string(),
        "mov" => "video/quicktime".to_string(),
        _ => "application/octet-stream".to_string(),
    }
}

/// 校验 PNG 是否包含透明通道（当前需求：不支持透明 PNG）。
///
/// 判定策略：
/// 1. IHDR 颜色类型为 4/6 时，天然包含 alpha，直接拒绝；
/// 2. 如果存在 `tRNS` chunk，也视为透明能力，直接拒绝。
///
/// 该函数只做“最低成本且足够稳定”的业务校验，不承担完整 PNG 解码职责。
pub fn png_has_transparency_channel(file_bytes: &[u8]) -> Result<bool, String> {
    const PNG_SIGNATURE: [u8; 8] = [137, 80, 78, 71, 13, 10, 26, 10];
    if file_bytes.len() < 33 {
        return Err("PNG 文件内容异常，无法解析。".to_string());
    }

    if file_bytes[..8] != PNG_SIGNATURE {
        return Err("文件扩展名为 PNG，但文件头不是合法 PNG。".to_string());
    }

    let mut cursor = 8usize;
    let mut saw_ihdr = false;

    while cursor + 8 <= file_bytes.len() {
        let length = u32::from_be_bytes([
            file_bytes[cursor],
            file_bytes[cursor + 1],
            file_bytes[cursor + 2],
            file_bytes[cursor + 3],
        ]) as usize;
        let chunk_type = &file_bytes[cursor + 4..cursor + 8];
        let data_start = cursor + 8;
        let data_end = data_start.saturating_add(length);
        let crc_end = data_end.saturating_add(4);

        if crc_end > file_bytes.len() {
            return Err("PNG 文件 chunk 长度异常，无法解析。".to_string());
        }

        if chunk_type == b"IHDR" {
            saw_ihdr = true;
            if length != 13 {
                return Err("PNG IHDR 长度异常。".to_string());
            }

            let color_type = file_bytes[data_start + 9];
            if color_type == 4 || color_type == 6 {
                return Ok(true);
            }
        }

        if chunk_type == b"tRNS" {
            return Ok(true);
        }

        if chunk_type == b"IDAT" && saw_ihdr {
            return Ok(false);
        }

        cursor = crc_end;
    }

    Err("PNG 文件缺少必要数据块，无法完成透明通道校验。".to_string())
}

fn is_supported_image_extension(extension: &str) -> bool {
    matches!(extension, "jpeg" | "jpg" | "png" | "bmp" | "webp")
}

fn is_supported_video_extension(extension: &str) -> bool {
    matches!(extension, "mp4" | "mov")
}

fn is_supported_audio_extension(extension: &str) -> bool {
    matches!(extension, "wav" | "mp3")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn should_detect_supported_media_types_by_extension() {
        assert_eq!(
            detect_media_type_by_extension("demo.jpeg").expect("jpeg should be supported"),
            UploadMediaType::Image
        );
        assert_eq!(
            detect_media_type_by_extension("clip.mp4").expect("mp4 should be supported"),
            UploadMediaType::Video
        );
        assert_eq!(
            detect_media_type_by_extension("sound.mp3").expect("mp3 should be supported"),
            UploadMediaType::Audio
        );
    }

    #[test]
    fn should_reject_unsupported_extension() {
        let error =
            detect_media_type_by_extension("archive.zip").expect_err("zip should be rejected");
        assert!(error.contains("仅支持以下格式"));
    }

    #[test]
    fn should_normalize_mime_type_by_extension_when_missing() {
        assert_eq!(normalize_mime_type("hello.mov", ""), "video/quicktime");
        assert_eq!(normalize_mime_type("hello.jpg", ""), "image/jpeg");
    }

    #[test]
    fn should_detect_png_transparency_by_ihdr_color_type() {
        // 颜色类型 6（RGBA）=> 含透明通道
        let png = build_minimal_png(6, None);
        let has_transparency = png_has_transparency_channel(&png).expect("png should be parsable");
        assert!(has_transparency);
    }

    #[test]
    fn should_detect_png_transparency_by_trns_chunk() {
        // 颜色类型 2（RGB）+ tRNS => 仍然具备透明能力
        let png = build_minimal_png(2, Some(vec![0, 0, 0]));
        let has_transparency = png_has_transparency_channel(&png).expect("png should be parsable");
        assert!(has_transparency);
    }

    #[test]
    fn should_accept_non_transparent_png() {
        // 颜色类型 2（RGB）且没有 tRNS => 非透明
        let png = build_minimal_png(2, None);
        let has_transparency = png_has_transparency_channel(&png).expect("png should be parsable");
        assert!(!has_transparency);
    }

    fn build_minimal_png(color_type: u8, optional_trns_data: Option<Vec<u8>>) -> Vec<u8> {
        let mut bytes = Vec::new();
        bytes.extend_from_slice(&[137, 80, 78, 71, 13, 10, 26, 10]); // signature

        // IHDR
        let mut ihdr_data = Vec::with_capacity(13);
        ihdr_data.extend_from_slice(&1u32.to_be_bytes()); // width
        ihdr_data.extend_from_slice(&1u32.to_be_bytes()); // height
        ihdr_data.push(8); // bit depth
        ihdr_data.push(color_type); // color type
        ihdr_data.push(0); // compression
        ihdr_data.push(0); // filter
        ihdr_data.push(0); // interlace
        append_chunk(&mut bytes, b"IHDR", &ihdr_data);

        if let Some(trns_data) = optional_trns_data {
            append_chunk(&mut bytes, b"tRNS", &trns_data);
        }

        // IDAT (最小空数据块，校验函数不会解码，因此内容无业务影响)
        append_chunk(&mut bytes, b"IDAT", &[0u8]);

        // IEND
        append_chunk(&mut bytes, b"IEND", &[]);
        bytes
    }

    fn append_chunk(target: &mut Vec<u8>, chunk_type: &[u8; 4], data: &[u8]) {
        target.extend_from_slice(&(data.len() as u32).to_be_bytes());
        target.extend_from_slice(chunk_type);
        target.extend_from_slice(data);
        // CRC 在本测试中不参与业务判断，填 0 即可
        target.extend_from_slice(&0u32.to_be_bytes());
    }
}
