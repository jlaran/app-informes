/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // El paquete compartido se publica como ESM compilado (dist), pero lo
  // transpilamos igualmente para tolerar consumo directo desde el workspace.
  transpilePackages: ['@informes/shared'],
};

export default nextConfig;
