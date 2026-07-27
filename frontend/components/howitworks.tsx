// components/HowItWorks.tsx
import React from 'react';
import { HiMiniVideoCamera, HiOutlineCpuChip, HiOutlineDocumentArrowDown } from 'react-icons/hi2';

const steps = [
  {
    icon: HiMiniVideoCamera,
    title: 'Upload Your Video',
    description: 'Simply drag and drop your meeting recording or paste a link from your preferred platform.',
    color: '#35b3c9'
  },
  {
    icon: HiOutlineCpuChip,
    title: 'AI Processing',
    description: 'Our advanced AI analyzes the content, identifies speakers, and extracts key information.',
    color: '#b524c5'
  },
  {
    icon: HiOutlineDocumentArrowDown,
    title: 'Get Your Summary',
    description: 'Receive a comprehensive summary with highlights, action items, and key decisions.',
    color: '#fec650'
  }
];

const HowItWorks = () => {
  return (
    <section className="py-20 px-4" style={{ backgroundColor: '#f8fafc' }}>
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold mb-4" style={{ color: '#b524c5' }}>
            How It Works
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Three simple steps to transform your meetings from recordings to insights
          </p>
          <div className="w-24 h-1 mx-auto mt-6" style={{ backgroundColor: '#fec650' }}></div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
          {/* Connection lines (hidden on mobile) */}
          <div className="hidden md:block absolute top-24 left-1/4 right-1/4 h-0.5 bg-gray-200 -z-10"></div>
          
          {steps.map((step, index) => (
            <div key={index} className="text-center relative">
              <div 
                className="w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 relative z-10"
                style={{ 
                  backgroundColor: step.color,
                  boxShadow: `0 10px 25px -5px ${step.color}40`
                }}
              >
                <step.icon className="w-12 h-12 text-white" />
              </div>
              
              <div className="absolute top-12 -right-4 hidden lg:block">
                {index < steps.length - 1 && (
                  <span className="text-2xl font-bold" style={{ color: '#35b3c9' }}>→</span>
                )}
              </div>
              
              <h3 className="text-2xl font-semibold mb-3 text-gray-800">{step.title}</h3>
              <p className="text-gray-600 max-w-sm mx-auto">{step.description}</p>
              
              <div 
                className="mt-4 text-sm font-semibold"
                style={{ color: step.color }}
              >
                Step {index + 1}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;