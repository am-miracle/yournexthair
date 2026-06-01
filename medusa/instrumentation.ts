// Uncomment this file to enable instrumentation and observability using OpenTelemetry
// Refer to the docs for installation instructions: https://docs.medusajs.com/v2/debugging-and-testing/instrumentation

// import { registerOtel } from "@medusajs/medusa"
// import { ZipkinExporter } from "@opentelemetry/exporter-zipkin"

// const exporter = new ZipkinExporter({
//   serviceName: "my-medusa-project",
// })

// export function register() {
//   registerOtel({
//     serviceName: "medusajs",
//     exporter,
//     instrument: {
//       http: true,
//       workflows: true,
//       remoteQuery: true,
//     },
//   })
// }
