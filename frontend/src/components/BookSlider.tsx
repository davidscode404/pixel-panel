'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import booksData from '../data/books.json';
import { buildApiUrl, API_CONFIG, cachedFetch } from '../config/api';
import { ComicPanel } from '../types';

interface Book {
  id: number | string; // Allow string for user comic titles
  title: string;
  author: string;
  color: string;
  gradient: string;
  image?: string; // Optional for user comics
  isUserComic?: boolean;
  panels?: ComicPanel[];
}

// interface SavedComic {
//   title: string;
//   date: string;
//   panels: ComicPanel[];
// }

// Helper function to format comic titles nicely
const formatComicTitle = (title: string): string => {
  return title
    .replace(/_/g, ' ') // Replace underscores with spaces
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()) // Capitalize each word
    .join(' ');
};

export default function BookSlider() {
  const [books, setBooks] = useState<Book[]>(booksData.books);
  const [currentIndex, setCurrentIndex] = useState(Math.floor(booksData.books.length / 2));

  // Load user's saved comic and replace "Where the Crawdads Sing"
  useEffect(() => {
    loadComicsFromDB();
    
    // Listen for storage events to refresh when new comics are saved
    const handleStorageChange = () => {
      loadComicsFromDB();
    };
    
    window.addEventListener('storage', handleStorageChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  const loadComicsFromDB = async () => {
    try {
      // Get list of saved comics from project directory
      const response = await cachedFetch(buildApiUrl(API_CONFIG.ENDPOINTS.LIST_COMICS));
      if (response.ok) {
        const data = await response.json();
        const comics = data.comics;
        
        if (comics.length > 0) {
          // Convert all user comics to Book objects
          const userComics: Book[] = comics.map((comic: { title: string; cover_image?: string }) => ({
            id: comic.title,
            title: formatComicTitle(comic.title),
            author: 'You',
            color: '#8B5CF6',
            gradient: 'from-purple-500 to-indigo-600',
            image: comic.cover_image || '/api/placeholder/400/600', // Use cover image if available
            isUserComic: true,
            panels: [] // We'll load panels when clicked
          }));
          
          // Create a new books array with user comics
          const updatedBooks: Book[] = [...booksData.books];
          
          const maxUserComics = Math.min(userComics.length, 6); 
          const comicsToShow = userComics.slice(0, maxUserComics);
          
          const centerIndex = 4;
          const halfUserComics = Math.floor(comicsToShow.length / 2);
          
          const startIndex = Math.max(0, centerIndex - halfUserComics);
          
          // Replace books with user comics
          comicsToShow.forEach((userComic, index) => {
            const bookIndex = startIndex + index;
            if (bookIndex < updatedBooks.length) {
              updatedBooks[bookIndex] = userComic;
            }
          });
          
          setBooks(updatedBooks);
          
          // Set the current index to the center (where the most recent comic is)
          setCurrentIndex(centerIndex);
        } else {
          setBooks(booksData.books);
        }
      } else {
        setBooks(booksData.books);
      }
    } catch {
      // If there's an error, just use the default books
      setBooks(booksData.books);
    }
  };


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
    <div className="w-full max-w-7xl mx-auto px-12">
      <div className="relative">
        {/* Navigation Arrows */}
        <button
          onClick={prevBook}
          className="absolute left-4 top-1/2 -translate-y-1/2 z-10 text-foreground-inverse hover:text-accent-light transition-colors"
          aria-label="Previous book"
        >
          <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
            <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/>
          </svg>
        </button>

        <button
          onClick={nextBook}
          className="absolute right-4 top-1/2 -translate-y-1/2 z-10 text-foreground-inverse hover:text-accent-light transition-colors"
          aria-label="Next book"
        >
          <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8.59 16.59L10 18l6-6-6-6-1.41 1.41L13.17 12z"/>
          </svg>
        </button>

        {/* Overlapping Cards Container */}
        <div className="relative h-96 flex justify-center items-center px-8">
          {books.map((book, index) => {
            const offset = index - currentIndex;
            const absOffset = Math.abs(offset);
            const isActive = index === currentIndex;
            
            // Calculate position and scale
            const translateX = offset * 100; // Increased spacing for wider books
            const scale = Math.max(isActive ? 1 : 0.9 - (absOffset * 0.05), 0.7);
            const zIndex = books.length - absOffset;
            const opacity = absOffset > 3 ? 0 : 1 - (absOffset * 0.2);
            
            return (
              <div
                key={book.id}
                className="absolute w-80 h-80 rounded-lg overflow-hidden shadow-xl transition-all duration-500 ease-out group"
                style={{
                  transform: `translateX(${translateX}px) scale(${scale})`,
                  zIndex: zIndex,
                  opacity: opacity,
                }}
                onMouseEnter={() => goToBook(index)}
              >
                {/* Book Image or Gradient Background */}
                <div className="absolute inset-0">
                  {book.isUserComic && book.image && book.image !== '/api/placeholder/400/600' ? (
                    // User comic with cover image
                    <>
                      <Image 
                        src={book.image} 
                        alt={book.title}
                        fill
                        className="object-cover"
                      />
                      {/* Overlay for better text readability */}
                      <div className="absolute inset-0 bg-black/30" />
                    </>
                  ) : book.isUserComic ? (
                    // User comic with gradient background (fallback)
                    <div className={`absolute inset-0 bg-gradient-to-br ${book.gradient} opacity-90`} />
                  ) : book.image ? (
                    // Regular book with image
                    <>
                      <Image 
                        src={book.image} 
                        alt={book.title}
                        fill
                        className="object-cover"
                      />
                      {/* Overlay for better text readability */}
                      <div className="absolute inset-0 bg-black/20" />
                    </>
                  ) : (
                    // Regular book with gradient background (fallback)
                    <div className={`absolute inset-0 bg-gradient-to-br ${book.gradient} opacity-90`} />
                  )}
                </div>
                

                {/* Content */}
                <div className="relative h-full p-6 flex flex-col justify-end text-white">
                  <div className="text-center transform transition-transform duration-300 group-hover:scale-105">
                    <h3 className="text-xl font-bold mb-2 leading-tight transition-all duration-300 group-hover:text-shadow-lg drop-shadow-lg">
                      {book.title}
                    </h3>
                    <p className="text-sm opacity-90 transition-opacity duration-300 group-hover:opacity-100 drop-shadow-md">
                      by {book.author}
                    </p>
                  </div>
                </div>

                {/* Decorative Elements */}
              </div>
            );
          })}
        </div>

        {/* Bar Indicator */}
        <div className="flex justify-center mt-8 gap-1">
          {books.map((_, index) => (
            <button
              key={index}
              onClick={() => goToBook(index)}
              className={`h-1 transition-all duration-300 ${
                index === currentIndex
                  ? 'w-8 bg-accent-light'
                  : 'w-4 bg-white/40 hover:bg-white/60'
              }`}
              aria-label={`Go to book ${index + 1}`}
            />
          ))}
        </div>
      </div>

    </div>
  );
}
