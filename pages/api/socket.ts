import type { NextApiRequest } from 'next';
import type { NextApiResponseWithSocket } from '@/lib/socket';
import { initSocket } from '@/lib/socket';

export const config = {
    api: {
        bodyParser: false,
    },
};

export default function handler(req: NextApiRequest, res: NextApiResponseWithSocket) {
    if (!res.socket.server.io) {
        console.log('Initializing Socket.IO server...');
        initSocket(res);
    }
    res.end();
}
