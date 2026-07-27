// components/Pricing.tsx
import React from 'react';
import { HiOutlineCheckCircle, HiOutlineXMark } from 'react-icons/hi2';

const plans = [
  {
    name: 'Starter',
    price: '$29',
    period: 'per month',
    description: 'Perfect for individuals and small teams getting started',
    features: [
      '10 hours of video processing',
      'Basic summaries',
      'Transcript export',
      'Email support',
      '7-day history'
    ],
    notIncluded: [
      'Speaker identification',
      'Action item detection',
      'Team collaboration'
    ],
    color: '#35b3c9',
    buttonText: 'Get Started'
  },
  {
    name: 'Professional',
    price: '$79',
    period: 'per month',
    description: 'Ideal for growing teams with advanced needs',
    features: [
      '50 hours of video processing',
      'Advanced AI summaries',
      'Full transcripts with timestamps',
      'Speaker identification',
      'Action item detection',
      'Team collaboration',
      '30-day history',
      'Priority support'
    ],
    notIncluded: [],
    color: '#b524c5',
    buttonText: 'Start Free Trial',
    popular: true
  },
  {
    name: 'Enterprise',
    price: '$199',
    period: 'per month',
    description: 'For organizations requiring maximum capability',
    features: [
      '200 hours of video processing',
      'Custom AI model training',
      'API access',
      'Advanced analytics',
      'Unlimited team members',
      '90-day history',
      'Dedicated support',
      'SLA guarantee'
    ],
    notIncluded: [],
    color: '#35b3c9',
    buttonText: 'Contact Sales'
  }
];

const Pricing = () => {
  return (
    <section className="py-20 px-4" style={{ backgroundColor: '#f8fafc' }}>
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold mb-4" style={{ color: '#b524c5' }}>
            Simple, Transparent Pricing
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Choose the plan that best fits your needs. No hidden fees.
          </p>
          <div className="w-24 h-1 mx-auto mt-6" style={{ backgroundColor: '#fec650' }}></div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {plans.map((plan, index) => (
            <div
              key={index}
              className={`rounded-2xl relative ${
                plan.popular ? 'transform scale-105 md:-translate-y-2' : ''
              }`}
              style={{ 
                backgroundColor: 'white',
                boxShadow: plan.popular ? `0 20px 40px -15px ${plan.color}40` : '0 10px 30px -10px rgba(0,0,0,0.1)'
              }}
            >
              {plan.popular && (
                <div 
                  className="absolute -top-4 left-1/2 transform -translate-x-1/2 px-4 py-1 rounded-full text-sm font-semibold text-white"
                  style={{ backgroundColor: '#fec650' }}
                >
                  Most Popular
                </div>
              )}
              
              <div className="p-8">
                <h3 className="text-2xl font-bold mb-2" style={{ color: plan.color }}>{plan.name}</h3>
                <p className="text-gray-600 mb-4">{plan.description}</p>
                
                <div className="mb-6">
                  <span className="text-4xl font-bold text-gray-800">{plan.price}</span>
                  <span className="text-gray-600 ml-2">{plan.period}</span>
                </div>
                
                <button
                  className="w-full py-3 rounded-lg font-semibold transition-all duration-300 hover:opacity-90 mb-8"
                  style={{ 
                    backgroundColor: plan.color,
                    color: 'white'
                  }}
                >
                  {plan.buttonText}
                </button>
                
                <div className="space-y-3">
                  {plan.features.map((feature, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <HiOutlineCheckCircle className="w-5 h-5 mt-0.5 flex-shrink-0" style={{ color: plan.color }} />
                      <span className="text-gray-600 text-sm">{feature}</span>
                    </div>
                  ))}
                  
                  {plan.notIncluded.map((feature, i) => (
                    <div key={i} className="flex items-start gap-2 opacity-50">
                      <HiOutlineXMark className="w-5 h-5 mt-0.5 flex-shrink-0 text-gray-400" />
                      <span className="text-gray-400 text-sm">{feature}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Pricing;