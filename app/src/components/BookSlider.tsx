'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import booksData from '../data/books.json';

interface Book {
  id: number | string; // Allow string for user comic titles
  title: string;
  author: string;
  color: string;
  gradient: string;
  image?: string; // Optional for user comics
  isUserComic?: boolean;
  panels?: any[];
}

interface SavedComic {
  title: string;
  date: string;
  panels: any[];
}

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
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [isPopupOpen, setIsPopupOpen] = useState(false);

  // Load user's saved comic and replace "Where the Crawdads Sing"
  useEffect(() => {
    console.log('BookSlider: Loading comics from project directory...');
    loadComicsFromDB();
    
    // Listen for storage events to refresh when new comics are saved
    const handleStorageChange = () => {
      console.log('BookSlider: Storage changed, refreshing comics...');
      loadComicsFromDB();
    };
    
    window.addEventListener('storage', handleStorageChange);
    
    // Also refresh every 2 seconds to catch new saves
    const interval = setInterval(() => {
      loadComicsFromDB();
    }, 2000);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, []);

  const loadComicsFromDB = async () => {
    try {
      // Get list of saved comics from project directory
      const response = await fetch('http://localhost:3004/list-comics');
      if (response.ok) {
        const data = await response.json();
        const comics = data.comics;
        console.log('Loaded comics from project directory:', comics);
        
        if (comics.length > 0) {
          // Convert all user comics to Book objects
          const userComics: Book[] = comics.map((comic: any, index: number) => ({
            id: comic.title,
            title: formatComicTitle(comic.title),
            author: 'You',
            color: '#8B5CF6',
            gradient: 'from-purple-500 to-indigo-600',
            image: '/api/placeholder/400/600', // Placeholder for user comics
            isUserComic: true,
            panels: [] // We'll load panels when clicked
          }));
          
          // Create a new books array with user comics
          // Put the most recent comic in the center (index 4)
          const updatedBooks = [...booksData.books];
          
          // If we have more user comics than available slots, just use the first few
          const maxUserComics = Math.min(userComics.length, 6); // Limit to 6 user comics max
          const comicsToShow = userComics.slice(0, maxUserComics);
          
          // Replace books with user comics, starting from the center
          const centerIndex = 4;
          const halfUserComics = Math.floor(comicsToShow.length / 2);
          
          // Calculate starting position to center the comics
          const startIndex = Math.max(0, centerIndex - halfUserComics);
          
          // Replace books with user comics
          comicsToShow.forEach((userComic, index) => {
            const bookIndex = startIndex + index;
            if (bookIndex < updatedBooks.length) {
              updatedBooks[bookIndex] = userComic as any; // Type assertion for mixed ID types
            }
          });
          
          setBooks(updatedBooks);
          
          // Set the current index to the center (where the most recent comic is)
          setCurrentIndex(centerIndex);
          console.log(`Added ${comicsToShow.length} user comics to books, centered at index ${centerIndex}`);
        } else {
          console.log('No saved comics found, using default books');
          setBooks(booksData.books);
        }
      } else {
        console.error('Failed to fetch comics list');
        setBooks(booksData.books);
      }
    } catch (error) {
      console.error('Error loading comics from project directory:', error);
      // If there's an error, just use the default books
      setBooks(booksData.books);
    }
  };

  const getAllComicsFromDB = async () => {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('ComicDatabase', 1);
      
      request.onerror = () => reject(request.error);
      
      request.onsuccess = () => {
        const db = request.result;
        const transaction = db.transaction(['comics'], 'readonly');
        const store = transaction.objectStore('comics');
        const index = store.index('date');
        
        const getAllRequest = index.getAll();
        getAllRequest.onsuccess = () => {
          // Sort by date descending (newest first)
          const comics = getAllRequest.result.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
          resolve(comics);
        };
        getAllRequest.onerror = () => reject(getAllRequest.error);
      };
      
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('comics')) {
          const store = db.createObjectStore('comics', { keyPath: 'id' });
          store.createIndex('title', 'title', { unique: false });
          store.createIndex('date', 'date', { unique: false });
        }
      };
    });
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

  const openBookPopup = async (book: Book) => {
    if (book.isUserComic) {
      // For user comics, redirect to create page with comic title as URL parameter
      try {
        // Use the original title (with underscores) for the backend
        const originalTitle = book.id as string; // The ID contains the original title
        const encodedTitle = encodeURIComponent(originalTitle);
        console.log(`Loading comic: '${book.title}' (original: '${originalTitle}') -> encoded: '${encodedTitle}'`);
        
        // Redirect to create page with comic title as URL parameter
        window.location.href = `/create?comic=${encodedTitle}`;
      } catch (error) {
        console.error('Error loading comic:', error);
        alert(`Failed to load comic: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    } else {
      setSelectedBook(book);
      setIsPopupOpen(true);
    }
  };

  const getComicFromDB = async (id: number) => {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('ComicDatabase', 1);
      
      request.onerror = () => reject(request.error);
      
      request.onsuccess = () => {
        const db = request.result;
        const transaction = db.transaction(['comics'], 'readonly');
        const store = transaction.objectStore('comics');
        
        const getRequest = store.get(id);
        getRequest.onsuccess = () => resolve(getRequest.result);
        getRequest.onerror = () => reject(getRequest.error);
      };
      
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('comics')) {
          const store = db.createObjectStore('comics', { keyPath: 'id' });
          store.createIndex('title', 'title', { unique: false });
          store.createIndex('date', 'date', { unique: false });
        }
      };
    });
  };

  const closePopup = () => {
    setIsPopupOpen(false);
    setSelectedBook(null);
  };

  return (
    <div className="w-full max-w-full mx-auto px-8">
      <div className="relative">
        {/* Navigation Arrows */}
        <button
          onClick={prevBook}
          className="absolute left-4 top-1/2 -translate-y-1/2 z-10 text-white hover:text-amber-200 transition-colors"
          aria-label="Previous book"
        >
          <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
            <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/>
          </svg>
        </button>

        <button
          onClick={nextBook}
          className="absolute right-4 top-1/2 -translate-y-1/2 z-10 text-white hover:text-amber-200 transition-colors"
          aria-label="Next book"
        >
          <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8.59 16.59L10 18l6-6-6-6-1.41 1.41L13.17 12z"/>
          </svg>
        </button>

        {/* Overlapping Cards Container */}
        <div className="relative h-96 flex justify-center items-center px-4">
          {books.map((book, index) => {
            const offset = index - currentIndex;
            const absOffset = Math.abs(offset);
            const isActive = index === currentIndex;
            
            // Calculate position and scale
            const translateX = offset * 80; // Increased overlap spacing
            const scale = Math.max(isActive ? 1 : 0.9 - (absOffset * 0.05), 0.7);
            const zIndex = books.length - absOffset;
            const opacity = absOffset > 3 ? 0 : 1 - (absOffset * 0.2);
            
            return (
              <div
                key={book.id}
                className="absolute w-64 h-80 rounded-lg overflow-hidden shadow-xl transition-all duration-500 ease-out cursor-pointer hover:shadow-2xl hover:scale-110 hover:brightness-110 group"
                style={{
                  transform: `translateX(${translateX}px) scale(${scale})`,
                  zIndex: zIndex,
                  opacity: opacity,
                }}
                onClick={() => openBookPopup(book)}
                onMouseEnter={() => goToBook(index)}
              >
                {/* Book Image or Gradient Background */}
                <div className="absolute inset-0">
                  {book.isUserComic ? (
                    // User comic with gradient background
                    <div className={`absolute inset-0 bg-gradient-to-br ${book.gradient} opacity-90`} />
                  ) : (
                    // Regular book with image
                    <>
                      <Image 
                        src={book.image || '/api/placeholder/400/600'} 
                        alt={book.title}
                        fill
                        className="object-cover"
                      />
                      {/* Overlay for better text readability */}
                      <div className="absolute inset-0 bg-black/20" />
                    </>
                  )}
                </div>
                
                {/* Top Right Arrow */}
                <div className="absolute top-4 right-4 opacity-70 group-hover:opacity-100 transition-opacity duration-300">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 17L17 7M17 7H7M17 7V17" />
                  </svg>
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
                  ? 'w-8 bg-amber-200'
                  : 'w-4 bg-white/40 hover:bg-white/60'
              }`}
              aria-label={`Go to book ${index + 1}`}
            />
          ))}
        </div>
      </div>

      {/* Book Popup Modal */}
      {isPopupOpen && selectedBook && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/70 backdrop-blur-sm transition-opacity duration-300"
            onClick={closePopup}
          />
          
          {/* Modal Content */}
          <div className="relative bg-gray-600 rounded-lg shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden transform transition-all duration-300 scale-100">
            {/* Close Button */}
            <button
              onClick={closePopup}
              className="absolute top-4 right-4 z-10 w-10 h-10 bg-black/20 hover:bg-black/30 rounded-full flex items-center justify-center transition-colors"
            >
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Book Content */}
            <div className="flex flex-col md:flex-row h-full">
              {/* Book Cover */}
              <div className={`md:w-2/3 h-80 md:h-auto relative flex items-center justify-center ${
                selectedBook.isUserComic ? `bg-gradient-to-br ${selectedBook.gradient}` : ''
              }`}>
                {selectedBook.isUserComic ? (
                  // User comic with gradient background
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center text-white p-8">
                      <h2 className="text-3xl font-bold mb-4 drop-shadow-lg">
                        {selectedBook.title}
                      </h2>
                      <p className="text-lg opacity-90 drop-shadow-md">
                        by {selectedBook.author}
                      </p>
                    </div>
                  </div>
                ) : (
                  // Regular book with image
                  <>
                    <Image 
                      src={selectedBook.image || '/api/placeholder/400/600'} 
                      alt={selectedBook.title}
                      fill
                      className="object-cover"
                    />
                    {/* Overlay for better text readability */}
                    <div className="absolute inset-0 bg-black/40" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="text-center text-white p-8">
                        <h2 className="text-3xl font-bold mb-4 drop-shadow-lg">
                          {selectedBook.title}
                        </h2>
                        <p className="text-lg opacity-90 drop-shadow-md">
                          by {selectedBook.author}
                        </p>
                      </div>
                    </div>
                  </>
                )}
                
                {/* Decorative Elements */}
              </div>

              {/* Book Details */}
              <div className="md:w-1/3 p-8 flex flex-col justify-center">
                <div className="space-y-6">
                  <div>
                    <h3 className="text-2xl font-bold mb-2 text-white">
                      Book Details
                    </h3>
                    <div className="space-y-3">
                      <div>
                        <span className="font-semibold text-gray-200">Title:</span>
                        <p className="text-white">{selectedBook.title}</p>
                      </div>
                      <div>
                        <span className="font-semibold text-gray-200">Author:</span>
                        <p className="text-white">{selectedBook.author}</p>
                      </div>
                      <div>
                        <span className="font-semibold text-gray-200">Genre:</span>
                        <p className="text-white">Featured Comic</p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold text-gray-200 mb-2">Description:</h4>
                    <p className="text-gray-300 leading-relaxed">
                      Discover this amazing comic story filled with adventure, mystery, and unforgettable characters. 
                      Perfect for readers who love engaging narratives and beautiful artwork.
                    </p>
                  </div>

                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
