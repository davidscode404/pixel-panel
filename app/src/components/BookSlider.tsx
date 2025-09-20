'use client';

import { useState } from 'react';
import booksData from '../data/books.json';

interface Book {
  id: number;
  title: string;
  author: string;
  color: string;
  gradient: string;
}

export default function BookSlider() {
  const books: Book[] = booksData.books;
  const [currentIndex, setCurrentIndex] = useState(Math.floor(books.length / 2));

  const nextBook = () => {
    setCurrentIndex((prev) => (prev < books.length - 1 ? prev + 1 : 0));
  };

  const prevBook = () => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : books.length - 1));
  };

  const goToBook = (index: number) => {
    setCurrentIndex(index);
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold mb-2">Featured Books</h2>
        <p className="text-gray-600 dark:text-gray-400">
          Discover your next great read
        </p>
      </div>

      <div className="relative">
        {/* Navigation Buttons */}
        <button
          onClick={prevBook}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-white dark:bg-gray-800 shadow-lg rounded-full p-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          aria-label="Previous book"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <button
          onClick={nextBook}
          className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-white dark:bg-gray-800 shadow-lg rounded-full p-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          aria-label="Next book"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>

        {/* Overlapping Cards Container */}
        <div className="relative h-96 flex justify-center items-center px-12">
          {books.map((book, index) => {
            const offset = index - currentIndex;
            const absOffset = Math.abs(offset);
            const isActive = index === currentIndex;
            
            // Calculate position and scale
            const translateX = offset * 60; // Overlap amount
            const scale = Math.max(isActive ? 1 : 0.9 - (absOffset * 0.05), 0.7);
            const zIndex = books.length - absOffset;
            const opacity = absOffset > 3 ? 0 : 1 - (absOffset * 0.2);
            
            return (
              <div
                key={book.id}
                className="absolute w-64 h-80 rounded-2xl overflow-hidden shadow-xl transition-all duration-500 ease-out cursor-pointer"
                style={{
                  transform: `translateX(${translateX}px) scale(${scale})`,
                  zIndex: zIndex,
                  opacity: opacity,
                }}
                onClick={() => goToBook(index)}
              >
                {/* Background Gradient */}
                <div className={`absolute inset-0 bg-gradient-to-br ${book.gradient} opacity-90`} />
                
                {/* Close Button */}
                <button
                  className="absolute top-4 right-4 w-8 h-8 bg-black bg-opacity-20 rounded-full flex items-center justify-center hover:bg-opacity-30 transition-all"
                  onClick={(e) => {
                    e.stopPropagation();
                    // Handle close/remove functionality here
                  }}
                >
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>

                {/* Content */}
                <div className="relative h-full p-6 flex flex-col justify-between text-white">
                  <div className="flex-1 flex items-center justify-center">
                    <div className="text-center">
                      <h3 className="text-xl font-bold mb-2 leading-tight">
                        {book.title}
                      </h3>
                      <p className="text-sm opacity-90">
                        by {book.author}
                      </p>
                    </div>
                  </div>

                  {/* Tag/Category */}
                  <div className="flex justify-center">
                    <span className="text-xs bg-white bg-opacity-20 px-3 py-1 rounded-full">
                      Featured
                    </span>
                  </div>
                </div>

                {/* Decorative Elements */}
                <div className="absolute top-0 right-0 w-20 h-20 bg-white bg-opacity-10 rounded-full -translate-y-10 translate-x-10" />
                <div className="absolute bottom-0 left-0 w-16 h-16 bg-black bg-opacity-10 rounded-full translate-y-8 -translate-x-8" />
              </div>
            );
          })}
        </div>

        {/* Dots Indicator */}
        <div className="flex justify-center mt-8 gap-2">
          {books.map((_, index) => (
            <button
              key={index}
              onClick={() => goToBook(index)}
              className={`w-3 h-3 rounded-full transition-all ${
                index === currentIndex
                  ? 'bg-blue-500 scale-125'
                  : 'bg-gray-300 dark:bg-gray-600 hover:bg-gray-400 dark:hover:bg-gray-500'
              }`}
              aria-label={`Go to book ${index + 1}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
