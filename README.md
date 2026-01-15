# Exid VPN

A modern, Solana-styled VPN client built with Electron, React, TypeScript, and Vite.

## Features

- 🌍 Browse VPN servers by Country → City → Server
- 🔐 Get V2Ray credentials for secure connections
- 🎨 Beautiful Solana-inspired UI with purple-teal gradients
- ⚡ Fast and responsive with Vite + React
- 🖥️ Native Windows application

## Development

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Install Dependencies

```bash
npm install
```

### Run in Development Mode

```bash
npm run dev
```

### Build for Production

```bash
npm run build
```

The built application will be in the `release` folder.

## Project Structure

```
exid-vpn/
├── electron/           # Electron main process
│   ├── main.ts         # Main process entry
│   ├── preload.ts      # Preload script (IPC bridge)
│   └── api/
│       └── dvpnsdk.ts  # API client
├── src/                # React renderer process
│   ├── main.tsx        # React entry
│   ├── App.tsx         # Main app component
│   ├── styles/         # Global CSS
│   ├── components/     # React components
│   ├── hooks/          # Custom hooks
│   └── types/          # TypeScript types
├── public/             # Static assets
└── release/            # Built application
```

## API Integration

The app connects to the DVPNSDK API to:
1. Register device on first launch
2. Fetch available countries with V2Ray servers
3. Get cities within a country
4. Get servers within a city
5. Create V2Ray credentials for connection

## License

MIT
