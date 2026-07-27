// components/Footer.tsx
import React from 'react';
import { 
  HiOutlineEnvelope,
  HiOutlinePhone,
  HiOutlineMapPin,
  HiOutlineHeart 
} from 'react-icons/hi2';
import { 
  FaTwitter, 
  FaLinkedin, 
  FaGithub, 
  FaYoutube 
} from 'react-icons/fa';

const Footer = () => {
  return (
    <footer className="text-white" style={{ backgroundColor: '#1a1a1a' }}>
      <div className="max-w-7xl mx-auto px-4 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-12">
          {/* Company Info */}
          <div>
            <h3 className="text-2xl font-bold mb-4" style={{ color: '#35b3c9' }}>
              MeetSum
            </h3>
            <p className="text-gray-400 mb-4">
              Transforming meeting recordings into actionable insights with cutting-edge AI technology.
            </p>
            <div className="flex gap-4">
              <a href="#" className="text-gray-400 hover:text-[#35b3c9] transition-colors">
                <FaTwitter className="w-5 h-5" />
              </a>
              <a href="#" className="text-gray-400 hover:text-[#b524c5] transition-colors">
                <FaLinkedin className="w-5 h-5" />
              </a>
              <a href="#" className="text-gray-400 hover:text-[#fec650] transition-colors">
                <FaGithub className="w-5 h-5" />
              </a>
              <a href="#" className="text-gray-400 hover:text-[#35b3c9] transition-colors">
                <FaYoutube className="w-5 h-5" />
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-lg font-semibold mb-4" style={{ color: '#b524c5' }}>
              Quick Links
            </h4>
            <ul className="space-y-2">
              {['About Us', 'Features', 'Pricing', 'Blog', 'Careers'].map((item) => (
                <li key={item}>
                  <a 
                    href="#" 
                    className="text-gray-400 hover:text-[#fec650] transition-colors"
                  >
                    {item}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Support */}
          <div>
            <h4 className="text-lg font-semibold mb-4" style={{ color: '#35b3c9' }}>
              Support
            </h4>
            <ul className="space-y-2">
              {['Help Center', 'Documentation', 'API Status', 'Contact Us', 'FAQ'].map((item) => (
                <li key={item}>
                  <a 
                    href="#" 
                    className="text-gray-400 hover:text-[#fec650] transition-colors"
                  >
                    {item}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact Info */}
          <div>
            <h4 className="text-lg font-semibold mb-4" style={{ color: '#b524c5' }}>
              Contact Us
            </h4>
            <ul className="space-y-3">
              <li className="flex items-start gap-3 text-gray-400">
                <HiOutlineEnvelope className="w-5 h-5 mt-0.5 flex-shrink-0" style={{ color: '#35b3c9' }} />
                <span>support@meetsum.com</span>
              </li>
              <li className="flex items-start gap-3 text-gray-400">
                <HiOutlinePhone className="w-5 h-5 mt-0.5 flex-shrink-0" style={{ color: '#b524c5' }} />
                <span>+1 (555) 123-4567</span>
              </li>
              <li className="flex items-start gap-3 text-gray-400">
                <HiOutlineMapPin className="w-5 h-5 mt-0.5 flex-shrink-0" style={{ color: '#fec650' }} />
                <span>123 Tech Street, San Francisco, CA 94105</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 border-t border-gray-800">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-gray-400 text-sm">
              © 2024 MeetSum. All rights reserved.
            </p>
            <div className="flex gap-6">
              {['Privacy Policy', 'Terms of Service', 'Cookie Policy'].map((item) => (
                <a 
                  key={item}
                  href="#" 
                  className="text-sm text-gray-400 hover:text-[#fec650] transition-colors"
                >
                  {item}
                </a>
              ))}
            </div>
            <p className="text-gray-400 text-sm flex items-center gap-1">
              Made with <HiOutlineHeart className="w-4 h-4" style={{ color: '#b524c5' }} /> by Your Team
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;