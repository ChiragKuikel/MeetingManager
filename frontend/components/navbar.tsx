"use client";

import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import { Menu, X, ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [activeLink, setActiveLink] = useState("/");


  const toggleMenu = () => setIsOpen(!isOpen);

  // Add blur + shadow when scrolling
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };

    // Update active link on page load
    const updateActiveLink = () => {
      setActiveLink(window.location.pathname);
    };

    window.addEventListener("scroll", handleScroll);
    window.addEventListener("load", updateActiveLink);
    
    // Initial update
    updateActiveLink();

    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("load", updateActiveLink);
    };
  }, []);

  

  const navLinks = [
    { name: "Home", href: "/" },
    { name: "About", href: "/about" },
    { name: "Summarize", href: "/video" },
    { name: "Tasks", href: "/tasks" },
    { name: "Contact", href: "/contact" },
  ];

 

  return (
    <motion.nav
      initial={{ y: -60, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className={`
        sticky top-0 z-50 border-b  rounded-4xl
        ${scrolled ? "bg-background/80 backdrop-blur-xl shadow-sm" : "bg-background"}
      `}
    >
      <div className="max-w-8xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-13">
          {/* Logo */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4 }}
          >
            <Link href="/" className="flex items-center gap-2">
               <div className="w-20 h-20 flex items-center justify-center">
                 <img src='/Logo.png' alt="Logo" /> 
              </div>

              <span className="text-lg font-bold text-primary sm:inline">
                AI meeting summarizer
              </span>
            </Link>
          </motion.div>

          {/* Desktop Menu */}
          <div className="hidden md:flex items-center gap-2">
            {/* Home */}
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0 * 0.08 }}
              className="relative"
            >
              <Link
                href="/"
                className={`relative text-text transition-colors text-md px-3 py-2 ${
                  activeLink === "/" 
                    ? "text-primary font-semibold" 
                    : "hover:text-primary"
                }`}
                onClick={() => {
                  setActiveLink("/");
                }}
              >
                Home
                
                {/* Rounded Rectangular Box Animation */}
                <motion.div
                  className="absolute inset-0 rounded-lg border-2 border-primary -z-10 bg-primary/20"
                  initial={false}
                  animate={{
                    scale: activeLink === "/" ? 1 : 0,
                    opacity: activeLink === "/" ? 1 : 0,
                  }}
                  transition={{ 
                    type: "spring", 
                    stiffness: 300, 
                    damping: 20,
                  }}
                />
              </Link>
            </motion.div>

            
            {/* Rest of the links (About, Vacancy, Blog, Contact) */}
            {["About", "Summarize", "Tasks", "Contact"].map((name, index) => {
              const link = navLinks.find(l => l.name === name);
              if (!link) return null;

              return (
                <motion.div
                  key={link.name}
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: (index + 2) * 0.08 }}
                  className="relative"
                >
                  <Link
                    href={link.href}
                    className={`relative text-text transition-colors text-md px-3 py-2 ${
                      activeLink === link.href 
                        ? "text-primary font-semibold" 
                        : "hover:text-primary"
                    }`}
                    onClick={() => {
                      setActiveLink(link.href);
                      
                    }}
                  >
                    {link.name}
                    
                    {/* Rounded Rectangular Box Animation */}
                    <motion.div
                      className="absolute inset-0 rounded-lg border-2 border-primary -z-10 bg-primary/20"
                      initial={false}
                      animate={{
                        scale: activeLink === link.href ? 1 : 0,
                        opacity: activeLink === link.href ? 1 : 0,
                      }}
                      whileHover={{ 
                        scale: activeLink === link.href ? 1 : 0.9,
                        opacity: activeLink === link.href ? 1 : 0.2,
                      }}
                      transition={{ 
                        type: "spring", 
                        stiffness: 300, 
                        damping: 20,
                      }}
                    />
                  </Link>
                </motion.div>
              );
            })}
          </div>

          {/* Mobile Menu Button */}
          <motion.button
            className="md:hidden text-text hover:text-primary transition-colors"
            onClick={toggleMenu}
            whileTap={{ scale: 0.9 }}
            animate={{ rotate: isOpen ? 180 : 0 }}
            transition={{ duration: 0.3 }}
            aria-label="Toggle menu"
          >
            {isOpen ? <X size={26} /> : <Menu size={26} />}
          </motion.button>
        </div>

        {/* Mobile Menu */}
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.35, ease: "easeOut" }}
              className="md:hidden border-t border-border overflow-hidden"
            >
              <div className="py-4 space-y-1">
                {/* Home */}
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0 * 0.1 }}
                >
                  <Link
                    href="/"
                    className={`block px-4 py-3 text-lg transition-all ${
                      activeLink === "/"
                        ? "bg-primary/10 text-primary font-semibold border-l-4 border-primary"
                        : "text-text hover:bg-gray-100 hover:text-primary"
                    }`}
                    onClick={() => {
                      setActiveLink("/");
                      setIsOpen(false);
                      
                    }}
                  >
                    Home
                  </Link>
                </motion.div>

                
                {/* Rest of links */}
                {["About", "Summarize", "Tasks", "Contact"].map((name, index) => {
                  const link = navLinks.find(l => l.name === name);
                  if (!link) return null;

                  return (
                    <motion.div
                      key={link.name}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: (index + 2) * 0.1 }}
                    >
                      <Link
                        href={link.href}
                        className={`block px-4 py-3 text-lg transition-all ${
                          activeLink === link.href
                            ? "bg-primary/10 text-primary font-semibold border-l-4 border-primary"
                            : "text-text hover:bg-gray-100 hover:text-primary"
                        }`}
                        onClick={() => {
                          setActiveLink(link.href);
                          setIsOpen(false);
                          
                        }}
                      >
                        {link.name}
                      </Link>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.nav>
  );
}