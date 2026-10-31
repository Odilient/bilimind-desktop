/**
 * The composer's "Build from a folder": the app's own dialog picks it, and it rides in the tray like an imported course.
 * What the chat sends is a token for the folder, never a path.
 */
export async function pickFolder(): Promise<{ id: string; title: string } | null> {
  return useApi().post<{ id: string; title: string; files: number } | null>('/companion/folders/pick')
}
