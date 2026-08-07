import { Request, Response } from 'express';
import { menuController } from './src/modules/menu/menu.controller';
import { menuService } from './src/modules/menu/menu.service';

// Mocking dependencies
(menuService as any).getMyMenu = async () => [{ title: 'Dashboard', route: '/' }];

const mockReq = {
  user: { role: { role: 'USER', permissions: new Map() } },
  entityType: '',
  locale: 'en'
} as any;

const mockRes = {
  json: (data: any) => {
    console.log('RESPONSE:', JSON.stringify(data, null, 2));
    return mockRes;
  }
} as any;

async function test() {
  await menuController.getMyMenu(mockReq, mockRes);
}

test();
