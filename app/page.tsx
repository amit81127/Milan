import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function LandingPage() {
  const { userId } = await auth();

  // If logged in, redirect to chat immediately
  if (userId) {
    redirect("/chat");
  }

  return (
    <div className="min-h-screen bg-black text-white selection:bg-zinc-800 selection:text-zinc-200">
      {/* Navbar */}
      <nav className="fixed top-0 w-full z-50 border-b border-white/5 bg-black/50 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-[0_0_20px_rgba(255,255,255,0.3)]">
              <span className="text-black font-black text-xl">M</span>
            </div>
            <span className="text-xl font-bold tracking-tighter">MILAN</span>
          </div>

          <div className="flex items-center gap-6">
            <Link href="/sign-in" className="text-sm font-medium text-zinc-400 hover:text-white transition-colors">
              Sign In
            </Link>
            <Link href="/sign-up" className="bg-white text-black px-5 py-2.5 rounded-full text-sm font-bold hover:bg-zinc-200 transition-all active:scale-95 shadow-[0_0_15px_rgba(255,255,255,0.2)]">
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="relative pt-32 pb-20 overflow-hidden">
        {/* Background Glows */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-zinc-900/30 rounded-full blur-[120px] -z-10 select-none pointer-events-none"></div>
        <div className="absolute top-[20%] right-[10%] w-[300px] h-[300px] bg-white/5 rounded-full blur-[80px] -z-10 select-none pointer-events-none"></div>

        <div className="max-w-7xl mx-auto px-6 text-center space-y-12">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-medium text-zinc-400 animate-in fade-in slide-in-from-bottom-4 duration-1000">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
              Private. Secure. Real-time.
            </div>

            <h1 className="text-6xl md:text-8xl font-black tracking-tight leading-[0.9] animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-100">
              THE NEXT GEN<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-b from-white to-zinc-500">MESSENGER.</span>
            </h1>

            <p className="max-w-2xl mx-auto text-lg md:text-xl text-zinc-500 font-medium leading-relaxed animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-200">
              Experience communication in its purest form. Milan brings speed, security, and cinematic aesthetics to every message you send.
            </p>
          </div>

          <div className="flex flex-col md:flex-row items-center justify-center gap-4 animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-300">
            <Link href="/sign-up" className="w-full md:w-auto bg-white text-black px-10 py-4 rounded-2xl font-bold text-lg hover:bg-zinc-200 transition-all active:scale-95 shadow-[0_20px_40px_rgba(255,255,255,0.1)]">
              Create Account
            </Link>
            <Link href="/chat" className="w-full md:w-auto px-10 py-4 rounded-2xl font-bold text-lg border border-white/10 hover:bg-white/5 transition-all">
              Live Demo
            </Link>
          </div>

          {/* App Mockup Preview */}
          <div className="relative mt-20 pt-10 px-4 animate-in fade-in zoom-in-95 duration-1000 delay-500">
            <div className="max-w-5xl mx-auto rounded-[32px] border border-white/10 bg-zinc-900/20 backdrop-blur-sm p-4 overflow-hidden shadow-[0_40px_100px_rgba(0,0,0,0.5)]">
              <div className="aspect-[16/9] rounded-[24px] bg-gradient-to-br from-zinc-800 to-black border border-white/5 flex items-center justify-center relative overflow-hidden group">
                <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=2564&auto=format&fit=crop')] bg-cover opacity-20 filter grayscale"></div>
                <div className="z-10 text-center space-y-4">
                  <div className="w-20 h-20 bg-white/5 border border-white/10 rounded-3xl flex items-center justify-center mx-auto backdrop-blur-xl group-hover:scale-110 transition-transform duration-500">
                    <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                  </div>
                  <p className="text-zinc-500 font-bold tracking-widest uppercase text-xs">Cinematic Experience</p>
                </div>
              </div>
            </div>

            {/* Decorative elements */}
            <div className="absolute -left-20 top-40 w-64 h-64 bg-white/5 rounded-full blur-3xl -z-10"></div>
            <div className="absolute -right-20 top-20 w-80 h-80 bg-zinc-900 rounded-full blur-3xl -z-10"></div>
          </div>
        </div>
      </main>

      {/* Features Preview */}
      <section className="py-32 border-t border-white/5">
        <div className="max-w-7xl mx-auto px-6 grid md:grid-cols-3 gap-12">
          <div className="space-y-4">
            <div className="w-12 h-12 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center text-white">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            </div>
            <h3 className="text-xl font-bold tracking-tight">Insane Speed</h3>
            <p className="text-zinc-500 leading-relaxed font-medium">Powered by Convex, messages arrive before you even lift your finger.</p>
          </div>
          <div className="space-y-4">
            <div className="w-12 h-12 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center text-white">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
            </div>
            <h3 className="text-xl font-bold tracking-tight">Clerk Auth</h3>
            <p className="text-zinc-500 leading-relaxed font-medium">Industry standard security ensures your account remains yours.</p>
          </div>
          <div className="space-y-4">
            <div className="w-12 h-12 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center text-white">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" /></svg>
            </div>
            <h3 className="text-xl font-bold tracking-tight">Cinematic UI</h3>
            <p className="text-zinc-500 leading-relaxed font-medium">A design system that feels more like a movie than an app.</p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-white/5 text-center">
        <p className="text-zinc-600 text-sm font-medium tracking-widest uppercase">
          &copy; 2026 MILAN MESSENGER. ALL RIGHTS RESERVED.
        </p>
      </footer>
    </div>
  );
}
