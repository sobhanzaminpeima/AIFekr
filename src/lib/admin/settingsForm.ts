/** Submit only the visible section; provider caches and secret settings are not form fields. */
export function sectionSettings(fields: readonly {key:string;default:string}[],values:Record<string,string>) {
 return Object.fromEntries(fields.map(field=>[field.key,values[field.key]??field.default]));
}
