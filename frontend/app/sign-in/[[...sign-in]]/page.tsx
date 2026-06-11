"use client";
import { SignIn } from "@clerk/nextjs";
import { dark } from "@clerk/themes";
import Link from "next/link";
import { motion } from "framer-motion";

export default function SignInPage() {
  return (
    <div className="min-h-screen bg-base text-hi flex flex-col items-center justify-center relative overflow-hidden"
      style={{ background: "radial-gradient(ellipse at 50% 50%, rgba(168,230,61,0.08) 0%, #0a0a0a 100%)" }}>
      
      {/* Grid background */}
      <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)", backgroundSize: "40px 40px" }} />
      
      <div className="relative z-10 w-full max-w-md px-6 flex flex-col items-center">
        <Link href="/" className="flex flex-col items-center justify-center mb-10 group">
          <motion.div 
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5, type: "spring" }}
            className="w-12 h-12 rounded-2xl bg-lime flex items-center justify-center mb-4 group-hover:scale-105 transition-transform"
            style={{ boxShadow: "0 0 20px rgba(168,230,61,0.3)" }}>
            <span className="text-black font-black text-xl">AG</span>
          </motion.div>
          <motion.h1 
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-2xl font-black text-hi tracking-tight">
            AgentGuard
          </motion.h1>
          <motion.p 
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-lo text-sm mt-1">
            The AI that watches your AI
          </motion.p>
        </Link>
        
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="w-full">
          <SignIn 
            appearance={{
              baseTheme: dark,
              variables: { colorPrimary: '#a8e63d', colorBackground: '#121212', colorInputBackground: '#1a1a1a', colorInputText: '#ffffff' },
              elements: { 
                card: "bg-surface border border-border shadow-2xl rounded-2xl mx-auto",
                headerTitle: "text-hi font-bold text-xl",
                headerSubtitle: "text-lo",
                socialButtonsBlockButton: "border border-border hover:bg-raised transition-all",
                socialButtonsBlockButtonText: "font-semibold",
                formButtonPrimary: "bg-lime text-black font-bold hover:bg-lime/90 transition-all",
                footerActionLink: "text-lime hover:text-lime/80 font-semibold"
              }
            }}
          />
        </motion.div>
      </div>
    </div>
  );
}
