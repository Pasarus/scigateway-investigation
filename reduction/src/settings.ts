import { PluginRoute } from './scigateway.actions';

export interface ReductionSettings {
    apiUrl: string;
    routes: PluginRoute[];
    helpSteps?: { target: string; content: string }[];
    pluginHost?: string;
}

export let settings: Promise<ReductionSettings | void>;
export const setSettings = (
    newSettings: Promise<ReductionSettings | void>
): void => {
    settings = newSettings;
};