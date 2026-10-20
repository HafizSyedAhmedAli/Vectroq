// apps/web/src/components/rates/field-styles.ts
// One source of truth for every input/select on the Rates page and the
// lead-convert form, so they always look the same.

const selectBase =
  "w-full cursor-pointer [&_select]:h-11 [&_select]:rounded-xl [&_select]:border-stone-200 [&_select]:bg-white [&_select]:pr-9 [&_select]:text-[15px] [&_select]:text-brand-black [&_select]:shadow-sm [&_select:hover]:border-stone-300 [&_select:focus-visible]:border-brand [&_select:focus-visible]:ring-brand/20 [&_svg]:right-3.5";

/** Select without a leading icon. */
export const selectCls = `${selectBase} [&_select]:pl-4`;

/** Select with a leading icon (use inside IconField). */
export const selectIconCls = `${selectBase} [&_select]:pl-10`;

const inputBase =
  "h-11 rounded-xl border-stone-200! bg-white! text-[15px] text-brand-black shadow-sm hover:border-stone-300! focus-visible:border-brand! focus-visible:ring-brand/20";

/** Input without a leading icon. */
export const inputCls = `${inputBase} px-4`;

/** Input with a leading icon. */
export const inputIconCls = `${inputBase} pl-10 pr-3`;
