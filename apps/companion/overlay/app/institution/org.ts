// No institutions on a computer of one's own: centres, classes and family pages live on bilimind.com.
// The shell asks the same questions as the hosted app and always hears "none".
export interface OrgSummary {
  id: number
  role: string
}

export function useOrg() {
  const orgs = useState<OrgSummary[] | null>('inst:orgs', () => [])
  return { orgs, list: async (_force = false): Promise<OrgSummary[]> => [] }
}
