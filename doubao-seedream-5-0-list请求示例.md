

# 要新增的模型名称：doubao-seedream-5-0-list（创建文件也是这个，这里的是别名）
注意：实际调用模型名称是：doubao-seedream-5-0-260128

#  文生图-生成单张图
```
import os
from openai import OpenAI


# 请确保您已将 API Key 存储在环境变量 ARK_API_KEY 中 
# 初始化Ark客户端，从环境变量中读取您的API Key 
client = OpenAI( 
    # 此为默认路径，您可根据业务所在地域进行配置 
    base_url="https://ark.cn-beijing.volces.com/api/v3", 
    # 从环境变量中获取您的 API Key。此为默认方式，您可根据需要进行修改 
    api_key=os.environ.get("ARK_API_KEY"), 
) 
 
imagesResponse = client.images.generate( 
    model="doubao-seedream-5-0-260128", 
    prompt="星际穿越，黑洞，黑洞里冲出一辆快支离破碎的复古列车，抢视觉冲击力，电影大片，末日既视感，动感，对比色，oc渲染，光线追踪，动态模糊，景深，超现实主义，深蓝，画面通过细腻的丰富的色彩层次塑造主体与场景，质感真实，暗黑风背景的光影效果营造出氛围，整体兼具艺术幻想感，夸张的广角透视效果，耀光，反射，极致的光影，强引力，吞噬",
    size="2K",
    response_format="url",
    extra_body={
        "watermark": True,
    },
) 
 
print(imagesResponse.data[0].url)
```


# 文生图-生成组图
```
import os
import base64
import datetime
from openai import OpenAI

# 请确保您已将 API Key 存储在环境变量 ARK_API_KEY 中 
# 初始化Ark客户端，从环境变量中读取您的API Key 
client = OpenAI( 
    # 此为默认路径，您可根据业务所在地域进行配置 
    base_url="https://ark.cn-beijing.volces.com/api/v3", 
    # 从环境变量中获取您的 API Key。此为默认方式，您可根据需要进行修改 
    api_key=os.environ.get("ARK_API_KEY"), 
) 
 
imagesResponse = client.images.generate( 
    model="doubao-seedream-5-0-260128", 
    prompt="生成一组共4张连贯插画，核心为同一庭院一角的四季变迁，以统一风格展现四季独特色彩、元素与氛围",
    size="2K",
    response_format="b64_json",
    stream=True,
    extra_body={
        "watermark": True,
        "sequential_image_generation": "auto",
        "sequential_image_generation_options": {
            "max_images": 4
        },
    },
) 
 
for event in imagesResponse:
    if event is None:
        continue
    elif event.type == "image_generation.partial_succeeded":
        if event.b64_json is not None:
            print(f"size={len(event.b64_json)}, base_64={event.b64_json}")
            try:
                script_dir = os.path.dirname(os.path.abspath(__file__))
                timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
                filename = f"generated_image_{timestamp}.png"
                filepath = os.path.join(script_dir, filename)
                image_data = base64.b64decode(event.b64_json)
                with open(filepath, "wb") as f:
                    f.write(image_data)
                print(f"图片已成功保存为: {filepath}")
            except Exception as e:
                print(f"错误：保存图片时出错 - {e}")
    elif event.type == "image_generation.completed":
        if event.usage is not None:
            print("Final completed event:")
            print("recv.Usage:", event.usage)
```


# 图生图-单张图生成单张图
```
import os
from openai import OpenAI

# 请确保您已将 API Key 存储在环境变量 ARK_API_KEY 中 
# 初始化Ark客户端，从环境变量中读取您的API Key 
client = OpenAI( 
    # 此为默认路径，您可根据业务所在地域进行配置 
    base_url="https://ark.cn-beijing.volces.com/api/v3", 
    # 从环境变量中获取您的 API Key。此为默认方式，您可根据需要进行修改 
    api_key=os.environ.get("ARK_API_KEY"), 
) 

imagesResponse = client.images.generate( 
    model="doubao-seedream-5-0-260128", 
    prompt="生成狗狗趴在草地上的近景画面",
    size="2K",
    response_format="url",
    extra_body = {
        "image": "https://ark-project.tos-cn-beijing.volces.com/doc_image/seedream4_imageToimage.png",
        "watermark": True
    }
) 

print(imagesResponse.data[0].url)
```
# 图生图-单张图生成组图
```
import os
import base64
import datetime
from openai import OpenAI

# 请确保您已将 API Key 存储在环境变量 ARK_API_KEY 中 
# 初始化Ark客户端，从环境变量中读取您的API Key 
client = OpenAI( 
    # 此为默认路径，您可根据业务所在地域进行配置 
    base_url="https://ark.cn-beijing.volces.com/api/v3", 
    # 从环境变量中获取您的 API Key。此为默认方式，您可根据需要进行修改 
    api_key=os.environ.get("ARK_API_KEY"), 
) 
 
imagesResponse = client.images.generate( 
    model="doubao-seedream-5-0-260128", 
    prompt="参考这个LOGO，做一套户外运动品牌视觉设计，品牌名称为GREEN，包括包装袋、帽子、纸盒、手环、挂绳等。绿色视觉主色调，趣味、简约现代风格", 
    size="2K",
    response_format="b64_json",
    stream=True,
    extra_body={
        "image": "https://ark-project.tos-cn-beijing.volces.com/doc_image/seedream4_imageToimages.png",
        "watermark": True,
        "sequential_image_generation": "auto",
        "sequential_image_generation_options": {
            "max_images": 5
        },
    }   
) 

for event in imagesResponse:
    if event is None:
        continue
    elif event.type == "image_generation.partial_succeeded":
        if event.b64_json is not None:
            print(f"size={len(event.b64_json)}, base_64={event.b64_json}")
            try:
                script_dir = os.path.dirname(os.path.abspath(__file__))
                timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
                filename = f"generated_image_{timestamp}.png"
                filepath = os.path.join(script_dir, filename)
                image_data = base64.b64decode(event.b64_json)
                with open(filepath, "wb") as f:
                    f.write(image_data)
                print(f"图片已成功保存为: {filepath}")
            except Exception as e:
                print(f"错误：保存图片时出错 - {e}")
    elif event.type == "image_generation.completed":
        if event.usage is not None:
            print("Final completed event:")
            print("recv.Usage:", event.usage)
```
# 图生图-多张参考图生成单张图
```
import os
from openai import OpenAI
# 请确保您已将 API Key 存储在环境变量 ARK_API_KEY 中 
# 初始化Ark客户端，从环境变量中读取您的API Key 
client = OpenAI( 
    # 此为默认路径，您可根据业务所在地域进行配置 
    base_url="https://ark.cn-beijing.volces.com/api/v3", 
    # 从环境变量中获取您的 API Key。此为默认方式，您可根据需要进行修改 
    api_key=os.environ.get("ARK_API_KEY"), 
) 
 
imagesResponse = client.images.generate( 
    model="doubao-seedream-5-0-260128", 
    prompt="将图1的服装换为图2的服装",
    size="2K",
    response_format="url",
    
    extra_body = {
        "image": ["https://ark-project.tos-cn-beijing.volces.com/doc_image/seedream4_imagesToimage_1.png", "https://ark-project.tos-cn-beijing.volces.com/doc_image/seedream4_imagesToimage_2.png"],
        "watermark": True,
        "sequential_image_generation": "disabled",
    }
) 
 
print(imagesResponse.data[0].url)
```

# 图生图-多张参考图生成组图
```
import os
import base64
import datetime
from openai import OpenAI


# 请确保您已将 API Key 存储在环境变量 ARK_API_KEY 中 
# 初始化Ark客户端，从环境变量中读取您的API Key 
client = OpenAI( 
    # 此为默认路径，您可根据业务所在地域进行配置 
    base_url="https://ark.cn-beijing.volces.com/api/v3", 
    # 从环境变量中获取您的 API Key。此为默认方式，您可根据需要进行修改 
    api_key=os.environ.get("ARK_API_KEY"), 
) 
 
imagesResponse = client.images.generate( 
    model="doubao-seedream-5-0-260128", 
    prompt="生成3张女孩和奶牛玩偶在游乐园开心地坐过山车的图片，涵盖早晨、中午、晚上",
    size="2K",
    response_format="b64_json",
    stream=True,
    extra_body={
        "image": ["https://ark-project.tos-cn-beijing.volces.com/doc_image/seedream4_imagesToimages_1.png", "https://ark-project.tos-cn-beijing.volces.com/doc_image/seedream4_imagesToimages_2.png"],
        "watermark": True,
        "sequential_image_generation": "auto",
        "sequential_image_generation_options": {
            "max_images": 3
        },
    }   
) 

for event in imagesResponse:
    if event is None:
        continue
    elif event.type == "image_generation.partial_succeeded":
        if event.b64_json is not None:
            print(f"size={len(event.b64_json)}, base_64={event.b64_json}")
            try:
                script_dir = os.path.dirname(os.path.abspath(__file__))
                timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
                filename = f"generated_image_{timestamp}.png"
                filepath = os.path.join(script_dir, filename)
                image_data = base64.b64decode(event.b64_json)
                with open(filepath, "wb") as f:
                    f.write(image_data)
                print(f"图片已成功保存为: {filepath}")
            except Exception as e:
                print(f"错误：保存图片时出错 - {e}")
    elif event.type == "image_generation.completed":
        if event.usage is not None:
            print("Final completed event:")
            print("recv.Usage:", event.usage)

```






