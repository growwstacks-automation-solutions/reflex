// Lets us `import template from "./*.txt"` — wrangler bundles .txt as a string
// (see the [[rules]] Text rule in wrangler.toml).
declare module "*.txt" {
  const content: string;
  export default content;
}
