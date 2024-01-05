export const debug = (...args: unknown[]) => {
  if (['true', '1', 'yes'].includes(String(process.env.DEBUG))) {
    console.log('*************************************************');
    console.log('[DEBUG]', ...args);
    console.log('*************************************************');
  }
};
