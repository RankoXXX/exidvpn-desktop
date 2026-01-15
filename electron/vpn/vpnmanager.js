import fs from 'fs';
import fsPromises from 'fs/promises';
import path from 'path';
import os from 'os';
import { spawn, exec as execCb } from 'child_process';
import { promisify } from 'util';
const exec = promisify(execCb);
import net from 'net';
import https from 'https';
import dns from 'dns';
import ip from 'ip';
import Randomstring from 'randomstring';
import { SocksClient } from 'socks';

function atob(str) {
    return Buffer.from(str, 'base64').toString('binary');
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

const STATUSES = {
    DISCONNECTED: 'disconnected',
    CONNECTED: 'connected',
    CONNECTING: 'connecting',
    DISCONNECTING: 'disconnecting'
};

class DNS {
    constructor() {
        if (DNS.instance instanceof DNS) return DNS.instance;

        this.list = [
            {
                id: 0,
                name: 'cloudflare.com',
                ipv4: ['1.1.1.1', '1.0.0.1'],
                ipv6: ['2606:4700:4700::1111', '2606:4700:4700::1001'],
            },
            {
                id: 1,
                name: 'google.com',
                ipv4: ['8.8.8.8', '8.8.4.4'],
                ipv6: ['2001:4860:4860:0:0:0:0:8888', '2001:4860:4860:0:0:0:0:8844']
            },
            {
                id: 2,
                name: 'quad9.net',
                ipv4: ['9.9.9.9', '149.112.112.112'],
                ipv6: ['2620:fe::fe', '2620:fe::9']
            },
        ];

        this.currentDNSIndex = 0;

        DNS.instance = this;
    }

    getDNSList() {
        return this.list;
    }

    getCurrentDNS() {
        return this.list[this.currentDNSIndex];
    }

    getCurrentDNSIndex() {
        return this.currentDNSIndex;
    }

    setCurrentDNSIndex(index) {
        if (!index) return this.getCurrentDNS();
        if (index >= this.list.length) { this.currentDNSIndex = this.list.length - 1; return this.getCurrentDNS(); }
        if (index < 0) { this.currentDNSIndex = 0; return this.getCurrentDNS(); }
        this.currentDNSIndex = index;
        return this.getCurrentDNS();
    }

    getDNSByIndex(index) {
        return this.list[index];
    }
}

class AdapterUtils {
    constructor(options) {
        this.adapterName = options.adapterName;
        this.dns = options.dns;
    }

    async assignStaticIp() {
        const adapterName = this.adapterName;
        const staticIPv4 = "192.168.123.1";
        const staticIPv6 = "fd12:3456:789a:1::1/64";
        const staticIPv4Mask = "255.255.255.0";

        await exec(`netsh interface ipv4 set address name="${adapterName}" source=static addr=${staticIPv4} mask=${staticIPv4Mask}`);
        await exec(`netsh interface ipv6 set address interface="${adapterName}" address=${staticIPv6} store=persistent`);
    }

    async removeStaticIp() {
        const adapterName = this.adapterName;
        await exec(`netsh interface ipv4 set address name="${adapterName}" source=dhcp`);
        await exec(`netsh interface ipv6 set address name="${adapterName}" source=dhcp`);
    }

    async assignDns(defaultInterface = null) {
        const adapterName = this.adapterName;
        const dns = this.dns.getCurrentDNS();

        await exec(`netsh interface ipv4 set dnsservers name="${adapterName}" static address=${dns.ipv4[0]} register=none validate=no`);
        await exec(`netsh interface ipv4 add dnsservers name="${adapterName}" address=${dns.ipv4[1]} index=2 validate=no`);
        await exec(`netsh interface ipv6 set dnsservers name="${adapterName}" static address=${dns.ipv6[0]} register=none validate=no`);
        await exec(`netsh interface ipv6 add dnsservers name="${adapterName}" address=${dns.ipv6[1]} index=2 validate=no`);

        if (defaultInterface) {
            await exec(`netsh interface ipv4 set dnsservers name="${defaultInterface}" static address=${dns.ipv4[0]} register=none validate=no`);
            await exec(`netsh interface ipv4 add dnsservers name="${defaultInterface}" address=${dns.ipv4[1]} index=2 validate=no`);
            await exec(`netsh interface ipv6 set dnsservers name="${defaultInterface}" static address=${dns.ipv6[0]} register=none validate=no`);
            await exec(`netsh interface ipv6 add dnsservers name="${defaultInterface}" address=${dns.ipv6[1]} index=2 validate=no`);
        }

        await exec('ipconfig /flushdns');
    }

    async removeDns(defaultInterface = null) {
        if (defaultInterface) {
            await exec(`netsh interface ipv4 set dnsservers name="${defaultInterface}" source=dhcp`);
            await exec(`netsh interface ipv6 set dnsservers name="${defaultInterface}" source=dhcp`);
        }

        const adapterName = this.adapterName;
        await exec(`netsh interface ipv4 set dnsservers name="${adapterName}" source=dhcp`);
        await exec(`netsh interface ipv6 set dnsservers name="${adapterName}" source=dhcp`);

        await exec('ipconfig /flushdns');
    }

    async assignGlobalTrafficRouteRule() {
        const adapterName = this.adapterName;
        const staticIPv4 = "192.168.123.1";
        const staticIPv6 = "fd12:3456:789a:1::1";

        await exec(`netsh interface ipv4 add route 0.0.0.0/0 "${adapterName}" ${staticIPv4} metric=1`);
        await exec(`netsh interface ipv6 add route ::/0 "${adapterName}" ${staticIPv6} metric=1`);
    }

    async removeGlobalTrafficRouteRule() {
        const adapterName = this.adapterName;
        const staticIPv4 = "192.168.123.1";
        const staticIPv6 = "fd12:3456:789a:1::1";

        await exec(`netsh interface ipv4 delete route 0.0.0.0/0 "${adapterName}" ${staticIPv4}`);
        await exec(`netsh interface ipv6 delete route ::/0 "${adapterName}" ${staticIPv6}`);
    }

    async vpnTrafficRouteRule(serverIp, gatewayIp) {
        if (!serverIp || !gatewayIp) { throw new Error('serverIp and gatewayIp are required'); }
        await exec(`route add ${serverIp} mask 255.255.255.255 ${gatewayIp}`);
    }

    async removeVpnTrafficRouteRule(serverIp) {
        if (!serverIp) { throw new Error('serverIp is required'); }
        await exec(`route delete ${serverIp}`);
    }

    async checkAdapterAvailable(adapterName) {
        try {
            const { stdout } = await exec(`netsh interface show interface name="${adapterName}"`);

            if (stdout.includes(adapterName)) {
                return true;
            } else {
                throw new Error(`Adapter "${adapterName}" not found.`);
            }
        } catch (error) {
            throw new Error(`Adapter "${adapterName}" not found.`);
        }
    }
}

class Network extends AdapterUtils {
    constructor(options) {
        super(options);
        this.GatewayIp = null;
        this.GatewayAdapterName = null;
        this.GatewayIps = null;
        this.platform = process.platform;
    }

    async getGatewayAdapterIp() {
        try {
            // Try using default-gateway first
            try {
                const defaultGateway = await import('default-gateway');
                const { gateway4sync } = defaultGateway.default;
                const { gateway: gatewayIp } = gateway4sync();
                this.GatewayIp = gatewayIp;
                return gatewayIp;
            } catch (defaultGatewayError) {
                console.log("default-gateway failed, trying alternative method");

                // Fallback: Use route print to get default gateway
                const { stdout } = await exec('route print 0.0.0.0');
                const lines = stdout.split('\n');

                for (const line of lines) {
                    // Look for the default route line (0.0.0.0)
                    if (line.includes('0.0.0.0') && line.includes('0.0.0.0')) {
                        const parts = line.trim().split(/\s+/);
                        if (parts.length >= 4) {
                            const gatewayIp = parts[2];
                            if (net.isIPv4(gatewayIp)) {
                                this.GatewayIp = gatewayIp;
                                return gatewayIp;
                            }
                        }
                    }
                }

                throw new Error('Could not find default gateway using route print');
            }
        } catch (error) {
            console.error("error getting gateway adapter ip:", error.message);
            throw error;
        }
    }

    async getGatewayInterfaceName() {
        if (!this.GatewayIp) { await this.getGatewayAdapterIp(); }
        try {
            const networkInterfaces = os.networkInterfaces();
            for (const interfaceName in networkInterfaces) {
                const networkInterface = networkInterfaces[interfaceName];
                for (const alias of networkInterface) {
                    if (alias.family === 'IPv4' && !alias.internal) {
                        const subnet = ip.subnet(alias.address, alias.netmask);
                        if (subnet.contains(this.GatewayIp)) {
                            this.GatewayAdapterName = interfaceName;
                            return interfaceName;
                        }
                    }
                }
            }
        } catch (error) {
            console.error(`No interface found containing the gateway IP ${this.GatewayIp}`);
            throw error;
        }
    }

    async getGatewayAdapterIps() {
        if (!this.GatewayAdapterName) { await this.getGatewayInterfaceName(); }
        const adapter = this.GatewayAdapterName;
        try {
            const interfaces = os.networkInterfaces();
            const ips = { ipv4: [], ipv6: [] };

            if (interfaces[adapter]) {
                for (const iface of interfaces[adapter]) {
                    if ('IPv4' === iface.family) {
                        ips.ipv4.push(iface.address);
                    } else if ('IPv6' === iface.family) {
                        ips.ipv6.push(iface.address);
                    }
                }
            }

            this.GatewayIps = {
                ...ips,
                ipv4Support: ips.ipv4.length > 0,
                ipv6Support: ips.ipv6.length > 0
            };
            return this.GatewayIps;
        } catch (error) {
            console.error('error getting gateway adapter ips');
            throw error;
        }
    }

    async getIPv4FromDomain(endpoint) {
        try {
            // Extract host from endpoint (host:port)
            let host = endpoint;
            if (endpoint.includes(':')) {
                host = endpoint.split(':')[0];
            }

            if (net.isIPv4(host)) {
                return host;
            } else {
                return new Promise((resolve, reject) => {
                    dns.resolve4(host, (err, addresses) => {
                        if (err) {
                            reject(new Error(`Failed to resolve ${host} to IPv4: ${err.message}`));
                        } else {
                            resolve(addresses[0]);
                        }
                    });
                });
            }
        } catch (error) {
            console.error(`Error getting IPv4 from endpoint ${endpoint}: ${error.message}`);
            throw error;
        }
    }

    async checkSocksInternetConnectivity(proxyIp, proxyPort) {
        const connectivityCheckDomain = 'www.google.com';
        try {
            const options = {
                hostname: connectivityCheckDomain,
                port: 443,
                path: '/',
                method: 'GET',
                timeout: 3000
            };

            if (proxyIp && proxyPort) {
                const agent = await SocksClient.createConnection({
                    proxy: {
                        ipaddress: proxyIp,
                        port: proxyPort,
                        type: 5
                    },
                    command: 'connect',
                    destination: {
                        host: options.hostname,
                        port: options.port
                    }
                });

                options.agent = new https.Agent({ socket: agent.socket });
            } else {
                console.log('Performing direct connectivity check');
                options.timeout = 10000;
                options.agent = new https.Agent({});
            }

            let retries = 0;
            const maxRetries = 3;
            while (retries <= maxRetries) {
                try {
                    return await new Promise((resolve, reject) => {
                        const req = https.request(options, (res) => {
                            let data = '';
                            res.on('data', (chunk) => {
                                data += chunk;
                            });
                            res.on('end', () => {
                                resolve(true);
                            });
                        });

                        req.on('error', (e) => {
                            console.error(`Request error: ${e.message}`);
                            reject(new Error('Internet connectivity check failed due to request error.'));
                        });

                        req.on('timeout', () => {
                            req.end();
                            console.error('Request timeout after 10 seconds.');
                            reject(new Error('Internet connectivity check failed due to timeout.'));
                        });

                        req.end();
                    });
                } catch (e) {
                    if (retries === maxRetries) throw e;
                    console.log(`Connectivity check retry ${retries + 1}/${maxRetries}`);
                    await delay(2000);
                    retries++;
                }
            }
        } catch (error) {
            console.error(`internet connectivity check failed`);
            throw new Error(`Internet connectivity check failed: ${error.message}`);
        }
    }
}

class SentinelAPI {
    constructor() {
        if (SentinelAPI.instance instanceof SentinelAPI) {
            return SentinelAPI.instance;
        }

        this.protocol = 'V2RAY';

        SentinelAPI.instance = this;
    }

    extractVpnConf(vpnPayloadobfs) {
        const { data: { protocol, payload, uid } } = vpnPayloadobfs;

        switch (protocol) {
            case 'V2RAY':
                return this.decodeV2RAYConf(payload, uid);
            default:
                throw new Error('Unsupported VPN protocol');
        }
    }

    decodeV2RAYConf(payload, uid) {
        try {
            let bytes_ = Buffer.from(atob(payload), 'binary');

            if (bytes_.length != 7) {
                return null;
            }

            let address = Array.from(bytes_.slice(0, 4)).join('.');

            let port = (bytes_[4] << 8) + bytes_[5];

            let transport_map = {
                1: "tcp",
                2: "mkcp",
                3: "websocket",
                4: "http",
                5: "domainsocket",
                6: "quic",
                7: "gun",
                8: "grpc",
            };
            let transport = transport_map[bytes_[6]] || "";

            let config = `{
        "dns": {
            "hosts": {
                "domain:googleapis.cn": "googleapis.com"
            },
            "servers": [
                "1.1.1.1",
                "1.0.0.1",
                "8.8.8.8"
            ]
        },
        "inbounds": [
            {
                "listen": "127.0.0.1",
                "port": 10808,
                "protocol": "socks",
                "settings": {
                    "auth": "noauth",
                    "udp": true,
                    "userLevel": 8
                },
                "sniffing": {
                    "destOverride": [
                        "http",
                        "tls",
                        "quic"
                    ],
                    "metadataOnly": false,
                    "routeOnly": false,
                    "enabled": true
                },
                "tag": "socks"
            },
            {
                "listen": "127.0.0.1",
                "port": 10809,
                "protocol": "http",
                "settings": {
                    "userLevel": 8,
                    "allowTransparent": false
                },
                "tag": "http"
            }
        ],
        "log": {
            "loglevel": "warning"
        },
        "outbounds": [
            {
                "mux": {
                    "concurrency": 8,
                    "enabled": true,
                    "xudpConcurrency": 16,
                    "xudpProxyUDP443": "reject"
                },
                "protocol": "vmess",
                "settings": {
                    "vnext": [
                        {
                            "address": "${address}",
                            "port": ${port},
                            "users": [
                                {
                                    "alterId": 0,
                                    "encryption": "",
                                    "flow": "",
                                    "id": "${uid}",
                                    "level": 8,
                                    "security": "auto"
                                }
                            ]
                        }
                    ]
                },
                "streamSettings": {
                    "network": "grpc",
                    "grpcSettings": {
                        "serviceName": "",
                        "multiMode": false
                    },
                    "sockopt": {
                        "mark": 0,
                        "tcpFastOpen": false,
                        "tproxy": "off"
                    }
                },
                "tag": "proxy"
            },
            {
                "protocol": "freedom",
                "settings": {
                    "domainStrategy": "UseIPv4"
                },
                "tag": "direct"
            },
            {
                "protocol": "blackhole",
                "settings": {
                    "response": {
                        "type": "http"
                    }
                },
                "tag": "block"
            }
        ],
        "routing": {
            "domainStrategy": "AsIs",
            "rules": [
                {
                    "type": "field",
                    "inboundTag": ["socks", "http"],
                    "outboundTag": "proxy"
                },
                {
                    "type": "field",
                    "domain": ["geosite:private"],
                    "outboundTag": "direct"
                },
                {
                    "type": "field",
                    "ip": ["geoip:private"],
                    "outboundTag": "direct"
                }
            ]
        },
        "policy": {
            "levels": {
                "8": {
                    "connIdle": 300,
                    "downlinkOnly": 1,
                    "handshake": 4,
                    "uplinkOnly": 1
                }
            },
            "system": {
                "statsOutboundUplink": true,
                "statsOutboundDownlink": true
            }
        }
      }`;

            return {
                config,
                port,
                uid,
                endpoint: address,
            };
        } catch (e) {
            console.error('v2ray config decode error');
            throw e;
        }
    }
}

class V2Ray extends Network {
    constructor(options) {
        super(options);
        this.config = null;
        this.endpoint = null;
        this.serverIp = null;
        this.port = null;
        this.uid = null;

        this.platform = process.platform;
        this.binaryDirPath = options.binaryDir;
        this.configDirPath = options.configDirPath;
        this.v2rayBinaryPath = path.join(this.binaryDirPath, 'xray.exe');
        this.tun2socksBinPath = path.join(this.binaryDirPath, 'tun2socks.exe');
        this.gatewayInterfaceName = null;

        this.v2rayconffname = 'v2ray_config.json';
        this.v2rayconfpath = path.join(this.configDirPath, this.v2rayconffname);

        this.v2rayProcess = null;
        this.tun2socksProcess = null;

        this.processTree = {
            isGatewayAdapterNameResolved: false,
            isConfigToDisk: false,
            isResolvedServerIp: false,
            isEstablishV2RAYTunnel: false,
            isv2rayConfigCleaned: false,
            isEstablishedInternalTunnel: false,
            isInternetConnectivityCheckPassed: false,
            isAdapterIpAssigned: false,
            isDnsAssigned: false,
            isGlobalTrafficRouteRuleAssigned: false,
            isGatewayAdapterIpResolved: false,
            isVpnTrafficRouteRuleAssigned: false,
        };
    }

    async connect({ config, endpoint, port, uid }) {
        if (!config) { throw new Error('config is required'); }
        if (!endpoint) { throw new Error('endpoint is required'); }
        if (!port) { throw new Error('port is required'); }
        if (!uid) { throw new Error('uid is required'); }
        this.config = config;
        this.endpoint = endpoint;
        this.port = port;
        this.uid = uid;

        try {
            try {
                console.log("Getting gateway interface name");
                this.gatewayInterfaceName = await this.getGatewayInterfaceName();
                this.processTree.isGatewayAdapterNameResolved = true;
            } catch (error) {
                console.error('Failed to get gateway interface name');
                throw new Error(error);
            }

            try {
                console.log("Writing v2ray config to disk");
                await this.writeConfigToDisk(config);
                this.processTree.isConfigToDisk = true;
            } catch (error) {
                console.error('Failed to write v2ray config to disk');
                await this.deleteConfigFromDisk();
                throw new Error(error);
            }

            try {
                console.log(`Resolving server IP for endpoint: ${this.endpoint}`);
                this.serverIp = await this.getIPv4FromDomain(this.endpoint);
                console.log(`Resolved server IP: ${this.serverIp}`);
                this.processTree.isResolvedServerIp = true;
            } catch (error) {
                console.error(`Failed to resolve server IP for ${this.endpoint}: ${error.message}`);
                throw new Error(error);
            }

            try {
                console.log("Establishing v2ray tunnel");
                await this.establishV2RAYTunnel();
                this.processTree.isEstablishV2RAYTunnel = true;
            } catch (error) {
                console.error('Failed to establish v2ray tunnel');
                await this.closeV2RAYTunnel();
                throw new Error(error);
            }

            try {
                console.log("Cleaning up v2ray config from disk");
                await this.deleteConfigFromDisk();
                this.processTree.isv2rayConfigCleaned = true;
            } catch (error) {
                console.error('Failed to clean up v2ray config from disk', error);
                throw new Error(error);
            }

            try {
                console.log("Checking internet connectivity through socks proxy");
                await this.checkSocksInternetConnectivity('127.0.0.1', 10808);
                this.processTree.isInternetConnectivityCheckPassed = true;
            } catch (error) {
                throw new Error('Failed to check internet connectivity through socks proxy');
            }

            try {
                console.log("Starting internal tunnel");
                await this.startInternalTunnel();
                this.processTree.isEstablishedInternalTunnel = true;
            } catch (error) {
                console.error('Failed to establish internal tunnel');
                await this.stopInternalTunnel();
                throw new Error(error);
            }

            try {
                console.log("Assigning static IP to adapter");
                await this.assignStaticIp();
                this.processTree.isAdapterIpAssigned = true;
            } catch (error) {
                console.error('Failed to assign static IP to adapter');
                await this.removeStaticIp();
                throw new Error(error);
            }

            try {
                console.log("Assigning DNS");
                await this.assignDns(this.gatewayInterfaceName);
                this.processTree.isDnsAssigned = true;
            } catch (error) {
                console.error('Failed to assign DNS');
                await this.removeDns(this.gatewayInterfaceName);
                throw new Error(error);
            }

            try {
                console.log("Assigning global traffic route rule");
                await this.assignGlobalTrafficRouteRule();
                this.processTree.isGlobalTrafficRouteRuleAssigned = true;
            } catch (error) {
                console.error('Failed to assign global traffic route rule');
                await this.removeGlobalTrafficRouteRule();
                throw new Error(error);
            }

            try {
                console.log("Getting gateway adapter IP");
                await this.getGatewayAdapterIp();
                this.processTree.isGatewayAdapterIpResolved = true;
            } catch (error) {
                console.error('Failed to get gateway adapter IP');
                throw new Error(error);
            }

            try {
                console.log("Assigning VPN traffic route rule");
                await this.vpnTrafficRouteRule(this.serverIp, this.GatewayIp);
                this.processTree.isVpnTrafficRouteRuleAssigned = true;
            } catch (error) {
                console.error('Failed to assign VPN traffic route rule');
                await this.removeVpnTrafficRouteRule(this.serverIp);
                throw new Error(error);
            }

            console.log("VPN connection established successfully");
            return true;
        } catch (error) {
            await this.disconnect();
            throw new Error(error);
        }
    }

    async disconnect() {
        let success = true;

        console.log("Disconnecting VPN");
        try {
            if (this.processTree.isGlobalTrafficRouteRuleAssigned) {
                try {
                    console.log("Removing global traffic route rule");
                    await this.removeGlobalTrafficRouteRule();
                } catch (error) {
                    console.error('Failed to remove global traffic route rule');
                    success = false;
                }
            }

            if (this.processTree.isVpnTrafficRouteRuleAssigned) {
                try {
                    console.log("Removing VPN traffic route rule");
                    await this.removeVpnTrafficRouteRule(this.serverIp);
                } catch (error) {
                    console.error('Failed to remove VPN traffic route rule');
                    success = false;
                }
            }

            if (this.processTree.isDnsAssigned) {
                try {
                    console.log("Removing DNS");
                    await this.removeDns(this.gatewayInterfaceName);
                } catch (error) {
                    console.error('Failed to remove DNS');
                    success = false;
                }
            }

            if (this.processTree.isAdapterIpAssigned) {
                try {
                    console.log("Removing static IP from adapter");
                    await this.removeStaticIp();
                } catch (error) {
                    console.error('Failed to remove static IP from adapter');
                    success = false;
                }
            }

            if (this.processTree.isEstablishedInternalTunnel) {
                try {
                    console.log("Stopping internal tunnel");
                    await this.stopInternalTunnel();
                } catch (error) {
                    console.error('Failed to stop internal tunnel');
                    success = false;
                }
            }

            if (this.processTree.isEstablishV2RAYTunnel) {
                try {
                    console.log("Closing v2ray tunnel");
                    await this.closeV2RAYTunnel();
                } catch (error) {
                    console.error('Failed to close v2ray tunnel');
                    success = false;
                }
            }

            if (this.processTree.isConfigToDisk) {
                try {
                    console.log("Cleaning up v2ray config from disk");
                    await this.deleteConfigFromDisk();
                } catch (error) {
                    console.error('Failed to delete v2ray config from disk');
                    success = false;
                }
            }

        } finally {
            this.processTree = {
                isGatewayAdapterNameResolved: false,
                isConfigToDisk: false,
                isResolvedServerIp: false,
                isEstablishV2RAYTunnel: false,
                isv2rayConfigCleaned: false,
                isEstablishedInternalTunnel: false,
                isInternetConnectivityCheckPassed: false,
                isAdapterIpAssigned: false,
                isDnsAssigned: false,
                isGlobalTrafficRouteRuleAssigned: false,
                isGatewayAdapterIpResolved: false,
                isVpnTrafficRouteRuleAssigned: false
            };
        }

        console.log("VPN disconnected successfully");
        return success;
    }

    async establishV2RAYTunnel() {
        try {
            return new Promise((resolve, reject) => {

                const configPath = this.v2rayconfpath;
                const v2rayBinPath = this.v2rayBinaryPath;

                const v2ray = spawn(v2rayBinPath, ['-config', configPath]);
                this.v2rayProcess = v2ray;

                // Add detailed logging
                v2ray.stdout.on('data', (data) => {
                    const output = data.toString().trim();
                    if (output) console.log(`v2ray stdout: ${output}`);
                });

                v2ray.stderr.on('data', (data) => {
                    const output = data.toString().trim();
                    if (output) console.error(`v2ray stderr: ${output}`);
                });

                v2ray.on('error', async (error) => {
                    console.error(`Failed to start v2ray process: ${error.message}`);
                    reject(new Error(`Failed to start v2ray process: ${error.message}`));
                });

                v2ray.on('close', async (code, signal) => {
                    console.log(`v2ray process exited with code ${code}, signal ${signal}`);
                    reject(new Error(`v2ray process exited with code ${code}`));
                });

                async function onDataReceived(data) {
                    const output = data.toString();
                    if (output.includes('Xray') && output.includes('started')) {
                        v2ray.stdout.removeListener('data', onDataReceived);
                        try {
                            resolve(true);
                        } catch (error) {
                            reject(new Error('Failed to establish VPN connection'));
                        }
                    }
                }
                v2ray.stdout.on('data', onDataReceived);
            });

        } catch (error) {
            throw new Error('An unexpected error occurred while establishing the tunnel');
        }
    }

    async closeV2RAYTunnel() {
        return new Promise((resolve, reject) => {

            const handleCleanup = () => {
                this.v2rayProcess = null;
                if (this.processTree) {
                    this.processTree.isEstablishV2RAYTunnel = false;
                }
            };

            if (!this.v2rayProcess) {
                console.warn("No v2ray process found to close.");
                handleCleanup();
                resolve(true);
                return;
            }

            try {
                this.v2rayProcess.kill();

                const handleProcessClosure = (eventName, detail) => {
                    return (code) => {
                        console.log(`v2ray process ${eventName}: ${detail}${code !== undefined ? ` with code ${code}` : ''}`);
                        handleCleanup();
                        resolve(eventName === 'close' || eventName === 'exit');
                    };
                };

                this.v2rayProcess.once('close', handleProcessClosure('exited', ''));
                this.v2rayProcess.once('error', handleProcessClosure('failed to close', 'due to an error '));
                this.v2rayProcess.once('exit', handleProcessClosure('exited', ''));
                this.v2rayProcess.once('disconnect', handleProcessClosure('disconnected', ''));

            } catch (error) {
                console.error(`Exception in closing v2ray process: ${error.message}`);
                handleCleanup();
                resolve(false);
            }
        });
    }

    async startInternalTunnel() {
        return new Promise((resolve, reject) => {

            const tun2socksBinPath = this.tun2socksBinPath;

            const tun2socks = spawn(tun2socksBinPath, [
                '-tcp-auto-tuning',
                '-device', `tun://${this.adapterName}`,
                '-proxy', 'socks5://127.0.0.1:10808'
            ]);
            this.tun2socksProcess = tun2socks;

            tun2socks.on('error', async (error) => {
                console.error(`Failed to start tun2socks process`);
                reject(false);
            });

            tun2socks.on('close', async (code) => {
                console.log(`tun2socks process exited with code ${code}`);
                reject(false);
            });

            const onDataReceived = async (data) => {
                const output = data.toString();

                if (output.includes(`level=info msg="[STACK] tun://${this.adapterName} <-> socks5://127.0.0.1:10808"`)) {
                    tun2socks.stdout.removeListener('data', onDataReceived);
                    resolve(true);
                }
            };

            tun2socks.stdout.on('data', onDataReceived);
        });
    }

    async stopInternalTunnel() {
        return new Promise((resolve, reject) => {

            const handleCleanup = () => {
                this.tun2socksProcess = null;
                if (this.processTree) {
                    this.processTree.isEstablishedInternalTunnel = false;
                }
            };

            if (!this.tun2socksProcess) {
                console.warn("No tun2socks process found to stop.");
                handleCleanup();
                resolve(true);
                return;
            }

            try {
                this.tun2socksProcess.kill();

                const handleProcessClosure = (eventName, detail) => {
                    return (code) => {
                        console.log(`tun2socks process ${eventName}: ${detail}${code !== undefined ? ` with code ${code}` : ''}`);
                        handleCleanup();
                        resolve(eventName === 'close' || eventName === 'exit');
                    };
                };

                this.tun2socksProcess.once('close', handleProcessClosure('exited', ''));
                this.tun2socksProcess.once('error', handleProcessClosure('failed to close', 'due to an error '));
                this.tun2socksProcess.once('exit', handleProcessClosure('exited', ''));
                this.tun2socksProcess.once('disconnect', handleProcessClosure('disconnected', ''));

            } catch (error) {
                console.error(`Exception in stopping tun2socks process: ${error.message}`);
                handleCleanup();
                resolve(false);
            }
        });
    }

    async writeConfigToDisk(config) {
        try {
            if (!config) {
                throw new Error('config is required');
            }

            if (!fs.existsSync(this.configDirPath)) {
                await fsPromises.mkdir(this.configDirPath, { recursive: true });
            }

            await fs.promises.writeFile(this.v2rayconfpath, config, { flag: 'w' });
            return true;
        } catch (error) {
            console.error('Error writing v2ray config to disk');
            throw new Error(error);
        }
    }

    async deleteConfigFromDisk() {
        try {
            await fsPromises.access(this.v2rayconfpath);
            await fsPromises.rm(this.v2rayconfpath);
        } catch (error) {
            // ignore
        }
        return true;
    }
}

class VPNManager {
    constructor(options = {}) {
        if (VPNManager.instance instanceof VPNManager) {
            return VPNManager.instance;
        }

        // Use Electron's resources path for accessing binaries
        let resourcesPath;
        if (process.resourcesPath && !process.resourcesPath.includes('node_modules')) {
            // Production mode - use Electron's resources path
            // extraResources copies 'bin' to process.resourcesPath/bin
            resourcesPath = process.resourcesPath;
        } else {
            // Development mode - use project's resources directory
            resourcesPath = path.join(process.cwd(), 'resources');
        }

        this.binaryDir = options.binaryDir || path.join(resourcesPath, 'bin');
        this.adapterName = options.adapterName || 'exid_vpn';
        this.protocolTag = options.protocolTag || 'vpnq';
        this.tempDir = options.tempDir || os.tmpdir();
        this.configDirPath = path.join(this.tempDir, Randomstring.generate());

        // Debug logging for path resolution
        console.log('VPNManager initialization:');
        console.log(`  Process resources path: ${process.resourcesPath}`);
        console.log(`  Resolved resources path: ${resourcesPath}`);
        console.log(`  Binary directory: ${this.binaryDir}`);
        console.log(`  Current working directory: ${process.cwd()}`);

        fsPromises.mkdir(this.configDirPath, { recursive: true }).catch(console.error);

        this.platform = process.platform;
        if (this.platform !== 'win32') {
            console.warn('This implementation is optimized for Windows. Adjustments may be needed for other platforms.');
        }

        this.dns = new DNS();
        this.sentinel = new SentinelAPI();

        const sharedOptions = {
            binaryDir: this.binaryDir,
            adapterName: this.adapterName,
            configDirPath: this.configDirPath,
            dns: this.dns
        };

        this.v2ray = new V2Ray(sharedOptions);

        this.protocol = null;
        this.isConnected = false;
        this.isConnectionProgress = false;
        this.isDisconnectionProgress = false;
        this.statusCallback = null;
        this.currentStatus = STATUSES.DISCONNECTED;

        VPNManager.instance = this;
    }

    setStatusCallback(callback) {
        this.statusCallback = callback;
    }

    setStatus(status) {
        this.currentStatus = status;
        if (this.statusCallback) {
            this.statusCallback(status);
        }
    }

    getStatus() {
        return this.currentStatus;
    }

    async connect(credentials) {
        if (this.isConnected) { throw new Error('vpn already connected'); }
        if (this.isConnectionProgress) { throw new Error("vpn connection state is connecting"); }
        if (this.isDisconnectionProgress) { throw new Error('vpn connection state is currently disconnecting '); }

        const { protocol, payload, uid } = credentials;

        if (!protocol || protocol !== 'V2RAY') {
            throw new Error('Only V2RAY protocol is supported');
        }

        this.protocol = protocol;
        this.isConnectionProgress = true;
        this.setStatus(STATUSES.CONNECTING);

        console.log("vpn connection trigger started on main process");

        try {
            const res = { data: { protocol, payload, uid } };

            console.log("v2ray connection initiated");
            const conf = this.sentinel.extractVpnConf(res);
            await this.v2ray.connect(conf);

            console.log('VPN connection established');
            this.isConnected = true;
            this.isConnectionProgress = false;
            this.setStatus(STATUSES.CONNECTED);
            return true;
        } catch (error) {
            this.isConnected = false;
            this.isConnectionProgress = false;
            try { await this.disconnect(); } catch (e) { console.error(e); }
            console.error(error);
            console.log("vpn connection failed");
            this.setStatus(STATUSES.DISCONNECTED);
            throw error;
        }
    }

    async disconnect() {
        if (this.isDisconnectionProgress) { console.log('vpn already disconnecting'); return; }
        if (this.isConnectionProgress) { console.log('vpn is connecting'); return; }

        if (!this.protocol) {
            this.setStatus(STATUSES.DISCONNECTED);
            return true;
        }

        this.isDisconnectionProgress = true;
        this.setStatus(STATUSES.DISCONNECTING);

        console.log("vpn disconnection trigger started on main process");

        try {
            console.log("v2ray disconnection initiated");
            await this.v2ray.disconnect();
        } catch (error) {
            console.error(error);
        } finally {
            this.isConnected = false;
            this.isDisconnectionProgress = false;
            this.setStatus(STATUSES.DISCONNECTED);
        }
        console.log('VPN disconnected');
        return true;
    }

    async cleanup() {
        let cmd = '';
        if (this.platform === 'win32') {
            cmd = ['rd', '/s', '/q', this.configDirPath];
            const shell = process.env.comspec;
            const args = ['/c', ...cmd];
            const childProcess = spawn(shell, args, { stdio: 'ignore', detached: true });
            childProcess.unref();
        } else if (this.platform === 'linux' || this.platform === 'darwin') {
            cmd = `rm -rf ${this.configDirPath}`;
            const childProcess = spawn(cmd, { shell: true, stdio: 'ignore', detached: true });
            childProcess.unref();
        }
    }
}

export default VPNManager;
export { STATUSES };
