import type { NextConfig } from "next";

const withBundleAnalyzer = require('@next/bundle-analyzer')({
    enabled: process.env.ANALYZE === 'true',
});

const nextConfig: NextConfig = {
    output: 'standalone', // Enable for Electron (spawned server)
    reactStrictMode: true,
    poweredByHeader: false,
    compress: true,
    images: {
        unoptimized: false, // Standard handling
        formats: ['image/avif', 'image/webp'],
        remotePatterns: [
            {
                protocol: 'https',
                hostname: 'picsum.photos',
            },
            {
                protocol: 'https',
                hostname: 'i.pravatar.cc',
            },
            {
                protocol: 'https',
                hostname: 'images.pexels.com',
            },
            {
                protocol: 'https',
                hostname: 'images.unsplash.com',
            },
        ],
    },
    compiler: {
        removeConsole: process.env.NODE_ENV === 'production',
    },
    turbopack: {
        root: process.cwd(),
        rules: {
            '*.svg': {
                loaders: ['@svgr/webpack'],
                as: '*.js',
            },
        },
    },
    async rewrites() {
        return [
            {
                source: "/api/:path*",
                destination: `http://127.0.0.1:8000/api/:path*`,
            },
        ];
    },
    // Performance optimizations
    experimental: {
        optimizePackageImports: [
            'lucide-react',
            'date-fns',
            '@radix-ui/react-avatar',
            '@radix-ui/react-checkbox',
            '@radix-ui/react-dialog',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-label',
            '@radix-ui/react-popover',
            '@radix-ui/react-scroll-area',
            '@radix-ui/react-select',
            '@radix-ui/react-separator',
            '@radix-ui/react-slot',
            '@radix-ui/react-tabs',
            '@radix-ui/react-tooltip',
            'zustand'
        ],
        scrollRestoration: true,
    },
    // Production optimizations
};

export default withBundleAnalyzer(nextConfig);