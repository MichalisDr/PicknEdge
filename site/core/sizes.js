/* Layout sizes the scripts need (canvas sizes and margins of the charts), read from config/sizes.json by their name: screen.component.part.property. */
import SIZES from '../config/sizes.json' with { type: 'json' };

export function size(name) {
  const [screen, component, part, ...rest] = name.split('.');
  const value = SIZES.component[screen]?.[component]?.[part]?.[rest.join('.')];
  if (value === undefined) throw new Error('no layout size named ' + name);
  return value;
}
