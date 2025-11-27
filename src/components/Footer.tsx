
import React from 'react';

export const Footer: React.FC = () => {
    return (
        <footer className="w-full bg-brand-secondary/30 border-t border-brand-secondary mt-auto">
            <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8 text-center text-brand-text-secondary">
                <div className="flex justify-center space-x-6 mb-4">
                    <a href="#" className="hover:text-white transition-colors"><i className="fab fa-github"></i></a>
                    <a href="#" className="hover:text-white transition-colors"><i className="fab fa-twitter"></i></a>
                    <a href="#" className="hover:text-white transition-colors"><i className="fab fa-linkedin"></i></a>
                </div>
                <div className="text-sm mb-2">
                    <a href="#" className="hover:text-white transition-colors">About</a>
                    <span className="mx-2">·</span>
                    <a href="#" className="hover:text-white transition-colors">Privacy Policy</a>
                    <span className="mx-2">·</span>
                    <a href="#" className="hover:text-white transition-colors">Terms of Service</a>
                </div>
                <p className="text-xs">
                    &copy; {new Date().getFullYear()} SonificA.R.T. Framework. All Rights Reserved.
                </p>
            </div>
        </footer>
    );
};
