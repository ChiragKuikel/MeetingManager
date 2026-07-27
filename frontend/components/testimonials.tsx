// components/Testimonials.tsx
import React from 'react';
import Image from 'next/image';
import { HiOutlineStar } from 'react-icons/hi2';

const testimonials = [
  {
    name: 'Sarah Johnson',
    role: 'Product Manager',
    company: 'TechCorp',
    content: 'This tool has revolutionized how our team processes meeting notes. We save hours every week!',
    rating: 5,
    image: 'https://i.pravatar.cc/150?img=1'
  },
  {
    name: 'Michael Chen',
    role: 'Team Lead',
    company: 'InnovateLabs',
    content: 'The accuracy of the summaries is impressive. It captures all the key points perfectly.',
    rating: 5,
    image: 'https://i.pravatar.cc/150?img=2'
  },
  {
    name: 'Emily Rodriguez',
    role: 'Project Coordinator',
    company: 'Creative Solutions',
    content: 'Finally, a tool that understands the context of our meetings. The highlight feature is a game-changer.',
    rating: 5,
    image: 'https://i.pravatar.cc/150?img=3'
  }
];

const Testimonials = () => {
  return (
    <section className="py-20 px-4 bg-white">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold mb-4" style={{ color: '#35b3c9' }}>
            Loved by Teams
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            See what our users have to say about their experience
          </p>
          <div className="w-24 h-1 mx-auto mt-6" style={{ backgroundColor: '#fec650' }}></div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {testimonials.map((testimonial, index) => (
            <div
              key={index}
              className="p-8 rounded-2xl relative"
              style={{ 
                background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
                boxShadow: '0 10px 40px -10px rgba(0,0,0,0.1)'
              }}
            >
              {/* Quote mark */}
              <div 
                className="absolute top-6 right-6 text-6xl opacity-10"
                style={{ color: '#b524c5' }}
              >
                &quot;
              </div>
              
              <div className="flex items-center mb-6">
                <div className="relative w-16 h-16 mr-4">
                  <Image
                    src={testimonial.image}
                    alt={testimonial.name}
                    fill
                    className="rounded-full object-cover"
                  />
                </div>
                <div>
                  <h4 className="font-semibold text-gray-800">{testimonial.name}</h4>
                  <p className="text-sm text-gray-600">{testimonial.role}</p>
                  <p className="text-sm" style={{ color: '#35b3c9' }}>{testimonial.company}</p>
                </div>
              </div>
              
              <p className="text-gray-700 mb-4 italic">&quot;{testimonial.content}&quot;</p>
              
              <div className="flex gap-1">
                {[...Array(testimonial.rating)].map((_, i) => (
                  <HiOutlineStar 
                    key={i} 
                    className="w-5 h-5 fill-current"
                    style={{ color: '#fec650' }}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Testimonials;