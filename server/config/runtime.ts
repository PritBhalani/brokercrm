/** Render sets RENDER=true; NODE_ENV may be unset on some hosts. */
export function isProductionRuntime(): boolean {
  return (
    process.env.NODE_ENV === 'production' || process.env.RENDER === 'true'
  );
}
