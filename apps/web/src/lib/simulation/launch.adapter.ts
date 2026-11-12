import { mockLaunchSimulator } from "./launch.mock";
import type { LaunchSimulator } from "./launch.types";

/**
 * The one place the launch scene gets its simulator from. When the engine team ships the
 * lunar launch model, replace this line with the real implementation of LaunchSimulator.
 */
export const launchSimulator: LaunchSimulator = mockLaunchSimulator;
