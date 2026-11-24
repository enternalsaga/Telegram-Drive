import { render } from '@testing-library/react';
import { AppProviders } from '../../src/components/shared/AppProviders';
import MobileDashboardFixture, {
  installMobileDashboardFixtureBridge,
  mobileDashboardFixtureFiles,
} from '../../src/components/dev/MobileDashboardFixture';

export function renderMobileDashboardFixture() {
  installMobileDashboardFixtureBridge();
  return render(<AppProviders><MobileDashboardFixture /></AppProviders>);
}

export { mobileDashboardFixtureFiles };
