import { PipelineStep, PipelineContext } from '../pipeline.types';
import { sshUtil, buildSudo } from '../../../utils/ssh.util';
import { deploymentPathUtil } from '../../../utils/path.util';

const sudo = (ctx: PipelineContext, cmd: string) =>
  buildSudo(ctx.target.privilegeEscalation, ctx.sshConfig.password, cmd);

const buildNginxConfig = (ctx: PipelineContext, uiStaticRoot?: string, apiPort?: number): string => {
  const appName = ctx.application.name;
  const lines: string[] = [
    `server {`,
    `    listen 80;`,
    `    server_name _;`,
    ``,
    `    # UI — serve static build`,
    ...(uiStaticRoot
      ? [
        `    root ${uiStaticRoot};`,
        `    index index.html;`,
        `    location / {`,
        `        try_files $uri $uri/ /index.html;`,
        `    }`,
      ]
      : []),
    ``,
    `    # API — reverse proxy`,
    ...(apiPort
      ? [
        `    location /api/ {`,
        `        proxy_pass http://127.0.0.1:${apiPort}/;`,
        `        proxy_http_version 1.1;`,
        `        proxy_set_header Host $host;`,
        `        proxy_set_header X-Real-IP $remote_addr;`,
        `        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;`,
        `        proxy_set_header Upgrade $http_upgrade;`,
        `        proxy_set_header Connection "upgrade";`,
        `    }`,
      ]
      : []),
    `}`,
  ];
  return lines.join('\n');
};

export const configureProxyStep: PipelineStep = {
  name: 'configure-proxy',

  shouldRun(ctx: PipelineContext): boolean {
    return ctx.target.reverseProxy === 'nginx-managed';
  },

  async run(ctx: PipelineContext): Promise<void> {
    const { application, target, sshConfig } = ctx;
    ctx.logger.info('Configuring nginx reverse proxy…');

    // Collect API port and UI build dir from all components
    const apiComponent = application.components.find((c) => c.type === 'node-api');
    const uiComponent = application.components.find((c) => c.type === 'react-ui');

    const apiPort = apiComponent?.port;
    const isSingle = application.layout === 'multi-repo' && application.components.length === 1;
    const uiStaticRoot = uiComponent
      ? `${deploymentPathUtil.componentCurrentSymlink(target.baseWebRoot, application.name, uiComponent.key, isSingle)}/${uiComponent.buildOutputDir || 'dist'}`
      : undefined;

    const configContent = buildNginxConfig(ctx, uiStaticRoot, apiPort);
    const nginxSitePath = `/etc/nginx/sites-available/${application.name}`;
    const nginxEnabledPath = `/etc/nginx/sites-enabled/${application.name}`;

    await sshUtil.writeFile(sshConfig, `/tmp/${application.name}.nginx.conf`, configContent, 15000);

    const commands = [
      `${sudo(ctx, `cp /tmp/${application.name}.nginx.conf ${nginxSitePath}`)}`,
      `${sudo(ctx, `ln -sfn ${nginxSitePath} ${nginxEnabledPath}`)}`,
      `${sudo(ctx, 'nginx -t')}`,
      `${sudo(ctx, 'systemctl reload nginx')}`,
    ].join(' && ');

    const result = await sshUtil.executeOnce(sshConfig, commands, 30000);

    if (result.code !== 0) {
      throw new Error(`nginx configuration failed: ${result.stderr}`);
    }

    ctx.logger.info('nginx configured and reloaded.');
  },
};
