// The two shapes the shared shell names; nothing here ever has a value on this computer.
export type OrgRole = 'owner' | 'manager' | 'teacher' | 'learner' | 'guardian'
export interface OrgMe {
  role: OrgRole
  org: { settings: { locale?: string | null } }
}
