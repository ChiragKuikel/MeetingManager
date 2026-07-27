"use client";
import { motion, AnimatePresence } from "framer-motion";



export default function HeroSection() {
  return (
    <section className="relative w-full h-96 sm:h-[500px] lg:h-[600px] overflow-hidden">
      {/* Carousel Background */}
      <div className="absolute inset-0">
        <AnimatePresence mode="wait">
          <motion.div
            className="absolute inset-0 bg-cover bg-center bg-no-repeat"
            style={{
              backgroundImage: `url('/Hero.jpg')`,
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.2, ease: "easeInOut" }}
          />
        </AnimatePresence>
      </div>

      {/* Semi-transparent overlay for text contrast - OPTIONAL */}


      {/* Content */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full flex items-center">
        <motion.div
          className="text-white max-w-2xl"
          initial="hidden"
          animate="visible"
          variants={{
            visible: {
              transition: {
                staggerChildren: 0.25,
              },
            },
          }}
        >
          {/* Heading with MULTIPLE text shadows for maximum visibility */}
          <motion.h1
            className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-4 ml-4 lg:ml-10 leading-tight"
            variants={{
              hidden: { opacity: 0, y: 40 },
              visible: { opacity: 1, y: 0 },
            }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            style={{
              textShadow: `
                /* Multiple layered shadows for guaranteed visibility */
                0px 2px 4px rgba(0, 0, 0, 0.8),
                0px 4px 8px rgba(0, 0, 0, 0.6),
                0px 8px 16px rgba(0, 0, 0, 0.4),
                2px 2px 0px rgba(0, 0, 0, 0.3)
              `
            }}
          >
            From meeting to meaning. <span
              className="text-secondary"
              style={{
                textShadow: `
                      0px 0px 6px rgba(255, 255, 255, 0.9),
                      0px 0px 10px rgba(255, 255, 255, 0.8),
                      2px 2px 4px rgba(0, 0, 0, 0.5)
                    `,
                    
                    

              }}
            >
              <br />
              in minutes
            </span>

          </motion.h1>

          {/* Description with enhanced visibility */}
          <motion.p
            className="text-lg sm:text-xl mb-8 font-medium"
            variants={{
              hidden: { opacity: 0, y: 30 },
              visible: { opacity: 1, y: 0 },
            }}
            transition={{ duration: 0.9, ease: "easeOut" }}
            style={{
              color: '#ffffff',
              textShadow: `
                0px 1px 3px rgba(0, 0, 0, 0.9),
                0px 2px 6px rgba(0, 0, 0, 0.7),
                0px 3px 9px rgba(0, 0, 0, 0.5)
              `
            }}
          >

          </motion.p>

          {/* Buttons with guaranteed contrast */}
          <motion.div
            className="flex gap-4 flex-wrap ml-4 lg:ml-10 "
            variants={{
              hidden: { opacity: 0, y: 20 },
              visible: { opacity: 1, y: 0 },
            }}
            transition={{ duration: 0.9, ease: "easeOut" }}
          >
            {/* Primary Button - Solid with shadow */}
            <motion.a
              href="/video"
              whileHover={{
                scale: 1.08,
                boxShadow: "0 15px 30px -10px rgba(255,215,0,0.5)"
              }}
              whileTap={{ scale: 0.95 }}
              className="px-8 py-4 rounded-full font-bold text-lg relative overflow-hidden group"
              style={{
                background: "linear-gradient(135deg, #667eea 0%, #764ba2 50%, #ff6b6b 100%)",
                backgroundSize: "200% auto",
                color: "white",
                border: "2px solid rgba(255,255,255,0.3)",
                boxShadow: "0 8px 20px rgba(0,0,0,0.3), 0 0 0 2px rgba(255,255,255,0.1) inset",
                transition: "all 0.3s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundPosition = "right center";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundPosition = "left center";
              }}
            >
              <span className="relative z-10 flex items-center gap-2">
                Summarize with AI
                <svg
                  className="w-5 h-5 group-hover:translate-x-1 transition-transform"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </span>
              <motion.div
                className="absolute inset-0 bg-white opacity-0 group-hover:opacity-20 transition-opacity duration-300"
                animate={{
                  scale: [1, 1.2, 1],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
              />
            </motion.a>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}