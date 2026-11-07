import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {title:'Gánh Xiếc | Không gian quản trị',description:'Đồng hành cùng mỗi bước tiến. Quản lý lịch dạy và tiến trình học tập tại Gánh Xiếc.',icons:{icon:'/favicon.svg'}};
export default function RootLayout({children}:{children:React.ReactNode}) { return <html lang="vi"><body>{children}</body></html>; }
