import Link from 'next/link';
import { BotMessageSquare, ScanSearch } from 'lucide-react'; // Updated Bot to BotMessageSquare
import { Button } from '@/components/ui/button';

export default function Navbar() {
  return (
    <nav className="bg-primary text-primary-foreground shadow-md">
      <div className="container mx-auto px-4 py-3 flex justify-between items-center">
        <Link href="/" className="text-2xl font-semibold hover:opacity-80 transition-opacity">
          DataLens AI
        </Link>
        <div className="space-x-2">
          <Button variant="ghost" asChild>
            <Link href="/" className="flex items-center">
              <ScanSearch className="mr-2 h-5 w-5" /> Data Capture
            </Link>
          </Button>
          <Button variant="ghost" asChild>
            <Link href="/assistant" className="flex items-center">
              <BotMessageSquare className="mr-2 h-5 w-5" /> AI Assistant
            </Link>
          </Button>
        </div>
      </div>
    </nav>
  );
}
