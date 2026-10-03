/** The longest path component JSR accepts, and the limit every Innis repository keeps. */
export const MAX_PATH_COMPONENT_LENGTH = 95

/** The paths, `/`-separated, holding a component longer than `limit` characters, in input order. */
export const overlongPaths = (
  paths: ReadonlyArray<string>,
  limit: number = MAX_PATH_COMPONENT_LENGTH,
): ReadonlyArray<string> => paths.filter((path) => path.split("/").some((component) => [...component].length > limit))
