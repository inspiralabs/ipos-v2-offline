import { create } from 'zustand';
import { getLicenseState, isLicenseValid, type LicenseState } from '@/lib/license';

interface LicenseStore {
  state: LicenseState;
  valid: boolean;
  refresh: () => void;
}

export const useLicenseStore = create<LicenseStore>((set) => {
  const state = getLicenseState();
  return {
    state,
    valid: isLicenseValid(state),
    refresh: () => {
      const s = getLicenseState();
      set({ state: s, valid: isLicenseValid(s) });
    },
  };
});
