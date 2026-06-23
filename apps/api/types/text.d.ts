// Lets `import template from "./x.txt"` resolve to the file's text content,
// paired with the [[rules]] type = "Text" entry in wrangler.toml.
declare module "*.txt" {
  const content: string;
  export default content;
}
