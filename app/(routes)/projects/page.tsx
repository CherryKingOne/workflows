import { ProjectList } from '../../../src/presentation/pages/projects/components/ProjectList';

export default function ProjectsPage() {
  return (
    <main className="flex-1 flex flex-col min-h-screen bg-black text-white">
      <ProjectList />
    </main>
  );
}
