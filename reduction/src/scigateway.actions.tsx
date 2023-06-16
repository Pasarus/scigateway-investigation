import { createAction } from '@reduxjs/toolkit';

const MicroFrontendId = "scigateway"

export const CustomFrontendMessageType = `${MicroFrontendId}:api`;
// parent app actions
export const registerRoute = createAction(
    `${CustomFrontendMessageType}:register_route`
);
export const requestPluginRerender = createAction(
    `${CustomFrontendMessageType}:plugin_rerender`
);
export const broadcastSignOut = createAction(
    `${CustomFrontendMessageType}:signout`
);

export interface PluginRoute {
    section: string;
    link: string;
    displayName: string;
    admin?: boolean;
    hideFromMenu?: boolean;
    order: number;
}