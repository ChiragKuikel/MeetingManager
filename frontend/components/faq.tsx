// components/FAQ.tsx
'use client';

import React, { useState } from 'react';
import { HiOutlineChevronDown } from 'react-icons/hi2';

const faqs = [
  {
    question: 'How accurate are the AI summaries?',
    answer: 'Our AI achieves over 95% accuracy in identifying key points and action items. It uses advanced natural language processing models specifically trained on business meetings.'
  },
  {
    question: 'What video formats are supported?',
    answer: 'We support all major video formats including MP4, MOV, AVI, and WebM. You can also upload audio files or provide links from platforms like Zoom, Google Meet, and Microsoft Teams.'
  },
  {
    question: 'Is my data secure?',
    answer: 'Absolutely. We use enterprise-grade encryption for all data. Your videos are processed securely and automatically deleted after 30 days unless you choose to keep them.'
  },
  {
    question: 'How long does processing take?',
    answer: 'Processing time depends on video length. Typically, a 1-hour meeting is processed in 5-10 minutes. You\'ll receive an email notification when your summary is ready.'
  },
  {
    question: 'Can I export the summaries?',
    answer: 'Yes, you can export summaries in multiple formats including PDF, DOCX, and TXT. You can also share them directly with team members.'
  },
  {
    question: 'Do you offer a free trial?',
    answer: 'Yes, we offer a 14-day free trial on our Professional plan with full access to all features. No credit card required.'
  }
];

const FAQ = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section className="py-20 px-4 bg-white">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold mb-4" style={{ color: '#35b3c9' }}>
            Frequently Asked Questions
          </h2>
          <p className="text-xl text-gray-600">
            Got questions? We&apos;ve got answers
          </p>
          <div className="w-24 h-1 mx-auto mt-6" style={{ backgroundColor: '#fec650' }}></div>
        </div>

        <div className="space-y-4">
          {faqs.map((faq, index) => (
            <div
              key={index}
              className="border border-gray-200 rounded-lg overflow-hidden"
            >
              <button
                className="w-full px-6 py-4 text-left flex items-center justify-between hover:bg-gray-50 transition-colors"
                onClick={() => setOpenIndex(openIndex === index ? null : index)}
              >
                <span className="font-semibold text-gray-800">{faq.question}</span>
                <HiOutlineChevronDown
                  className={`w-5 h-5 transition-transform duration-300 ${
                    openIndex === index ? 'transform rotate-180' : ''
                  }`}
                  style={{ color: '#b524c5' }}
                />
              </button>
              
              <div
                className={`px-6 overflow-hidden transition-all duration-300 ${
                  openIndex === index ? 'py-4' : 'max-h-0'
                }`}
                style={{ backgroundColor: '#f8fafc' }}
              >
                <p className="text-gray-600">{faq.answer}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-12 text-center">
          <p className="text-gray-600 mb-4">Still have questions?</p>
          <button
            className="px-8 py-3 rounded-lg font-semibold transition-all duration-300 hover:opacity-90"
            style={{ 
              backgroundColor: '#fec650',
              color: '#1a1a1a'
            }}
          >
            Contact Support
          </button>
        </div>
      </div>
    </section>
  );
};

export default FAQ;