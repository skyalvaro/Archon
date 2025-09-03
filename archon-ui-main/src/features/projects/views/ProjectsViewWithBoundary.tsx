import { FeatureErrorBoundary } from '../../ui/components';
import { ProjectsView } from './ProjectsView';

export const ProjectsViewWithBoundary = () => {
  return (
    <FeatureErrorBoundary featureName="Projects">
      <ProjectsView />
    </FeatureErrorBoundary>
  );
};