// The study sidebar's door to an institution, which never shows here (see org.ts).
export interface InstitutionPlace {
  to: string
  label: string
  icon: string
  keys: string
  active: (path: string) => boolean
}

export const useInstitutionPlace = () => computed<InstitutionPlace | null>(() => null)
export const institutionHome = async (_force = true): Promise<string> => '/app'
export const homeFor = async (_force = true): Promise<string> => '/app'
export const setMode = (_mode: 'org' | 'study'): void => {}
export const lastMode = (): 'org' | 'study' | null => 'study'
