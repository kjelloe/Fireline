// engine/uav.js — W4-7 (Q79 ruling): the UAV sweep's shared constants.
// The command, the pool and the ageing live in the reducer; only the
// geometry is needed by los.js, and a tiny module keeps that import
// from dragging the reducer into the LOS path.
export const UAV_RADIUS_CELLS = 8;
