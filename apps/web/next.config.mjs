/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: [
      "images.unsplash.com",
      "scontent.cdninstagram.com",
      "graph.facebook.com"
    ],
  },
};

export default nextConfig;
