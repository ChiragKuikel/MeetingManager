// components/Features.tsx
import React from 'react';
import { 
  HiOutlineSparkles, 
  HiOutlineClock, 
  HiOutlineChatBubbleLeftRight,
  HiOutlineDocumentText,
  HiOutlineUsers,
  HiOutlineShieldCheck 
} from 'react-icons/hi2';

const features = [
  {
    icon: HiOutlineSparkles,
    title: 'AI-Powered Summaries',
    description: 'Get concise, accurate summaries of your meetings powered by advanced AI technology.'
  },
  {
    icon: HiOutlineClock,
    title: 'Save Time',
    description: 'Reduce meeting review time by 80% with instant highlights and key points extraction.'
  },
  {
    icon: HiOutlineChatBubbleLeftRight,
    title: 'Speaker Identification',
    description: 'Clear attribution of who said what with intelligent speaker recognition.'
  },
  {
    icon: HiOutlineDocumentText,
    title: 'Smart Transcripts',
    description: 'Searchable transcripts with timestamps and automatic action item detection.'
  },
  {
    icon: HiOutlineUsers,
    title: 'Team Collaboration',
    description: 'Share summaries and insights seamlessly with your entire team.'
  },
  {
    icon: HiOutlineShieldCheck,
    title: 'Secure & Private',
    description: 'Enterprise-grade security ensuring your meeting data remains confidential.'
  }
];

const Features = () => {
  return (
    <section className="py-20 px-4 bg-white">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold mb-4" style={{ color: '#35b3c9' }}>
            Powerful Features
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Transform your meeting recordings into actionable insights with our comprehensive toolkit
          </p>
          <div className="w-24 h-1 mx-auto mt-6" style={{ backgroundColor: '#fec650' }}></div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <div
              key={index}
              className="p-6 rounded-2xl border border-gray-100 hover:shadow-xl transition-shadow duration-300"
            >
              <div 
                className="w-12 h-12 rounded-lg flex items-center justify-center mb-4"
                style={{ backgroundColor: `${index % 2 === 0 ? '#35b3c9' : '#b524c5'}20` }}
              >
                <feature.icon 
                  className="w-6 h-6" 
                  style={{ color: index % 2 === 0 ? '#35b3c9' : '#b524c5' }}
                />
              </div>
              <h3 className="text-xl font-semibold mb-2 text-gray-800">{feature.title}</h3>
              <p className="text-gray-600 leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Features;