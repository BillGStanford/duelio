// Curated article pools. Targets are well-known, well-linked pages so every round is
// winnable; starts are a deliberately odd mix so each route feels different.
// Titles are resolved through Wikipedia's summary endpoint (which follows redirects), and
// planRounds() supplies alternates, so a renamed article never breaks a game.

export const TARGET_POOL: readonly string[] = [
  // Landmarks and places
  'Eiffel Tower', 'Great Wall of China', 'Taj Mahal', 'Statue of Liberty', 'Colosseum', 'Machu Picchu',
  'Mount Everest', 'Niagara Falls', 'Big Ben', 'Sydney Opera House', 'Golden Gate Bridge', 'Burj Khalifa',
  'Stonehenge', 'Petra', 'Angkor Wat', 'Great Pyramid of Giza', 'Mount Fuji', 'Grand Canyon', 'Amazon River',
  'Sahara', 'Antarctica', 'Pacific Ocean', 'Vatican City', 'Louvre', 'Buckingham Palace', 'Moscow Kremlin',
  'Leaning Tower of Pisa', 'Acropolis of Athens', 'Hagia Sophia', 'Alhambra', 'Neuschwanstein Castle',
  'Times Square', 'Hollywood Sign', 'Empire State Building', 'Panama Canal', 'Suez Canal', 'Great Barrier Reef',
  'Yellowstone National Park', 'Victoria Falls', 'Mount Kilimanjaro', 'Dead Sea',
  // Countries and cities
  'Japan', 'Brazil', 'Egypt', 'India', 'Canada', 'Australia', 'Italy', 'Mexico', 'Kenya', 'Iceland', 'Ethiopia',
  'New York City', 'Tokyo', 'Paris', 'London', 'Rome', 'Istanbul', 'Dubai', 'Singapore', 'Cairo',
  'Rio de Janeiro', 'Addis Ababa', 'Lagos', 'Mumbai', 'Sydney',
  // People
  'Albert Einstein', 'Leonardo da Vinci', 'William Shakespeare', 'Cleopatra', 'Napoleon', 'Marie Curie',
  'Isaac Newton', 'Nelson Mandela', 'Wolfgang Amadeus Mozart', 'Michael Jackson', 'Muhammad Ali', 'Pelé',
  'Lionel Messi', 'Cristiano Ronaldo', 'Abraham Lincoln', 'Mahatma Gandhi', 'Martin Luther King Jr.',
  'Genghis Khan', 'Alexander the Great', 'Julius Caesar', 'Charles Darwin', 'Nikola Tesla', 'Stephen Hawking',
  'Pablo Picasso', 'Vincent van Gogh', 'Ludwig van Beethoven', 'Elvis Presley', 'Beyoncé', 'Taylor Swift',
  'Barack Obama', 'Queen Victoria', 'Winston Churchill', 'Aristotle', 'Socrates', 'Confucius', 'Steve Jobs',
  'Elon Musk', 'Bill Gates', 'Walt Disney', 'Charlie Chaplin', 'Bruce Lee', 'Serena Williams', 'Usain Bolt',
  'Michael Jordan', 'Neil Armstrong', 'Yuri Gagarin', 'Haile Selassie',
  // Science and nature
  'Black hole', 'DNA', 'Periodic table', 'Photosynthesis', 'Volcano', 'Earthquake', 'Tsunami',
  'Tropical cyclone', 'Solar System', 'Milky Way', 'Moon', 'Sun', 'Mars', 'Jupiter', 'Saturn', 'Venus', 'Earth',
  'Electricity', 'Gravity', 'Evolution', 'Dinosaur', 'Tyrannosaurus', 'Blue whale', 'Elephant', 'Lion', 'Tiger',
  'Penguin', 'Honey bee', 'Octopus', 'Shark', 'Giant panda', 'Dog', 'Cat', 'Horse', 'Wolf', 'Butterfly', 'Rose',
  'Bamboo',
  // Food and drink
  'Pizza', 'Coffee', 'Chocolate', 'Banana', 'Apple', 'Rice', 'Bread', 'Tea', 'Wine', 'Beer', 'Sushi',
  'Hamburger', 'Ice cream', 'Cheese', 'Olive oil',
  // History
  'World War I', 'World War II', 'French Revolution', 'Apollo 11', 'Cold War', 'Renaissance',
  'Industrial Revolution', 'Roman Empire', 'Ancient Egypt', 'Ottoman Empire', 'Silk Road', 'Black Death',
  'American Civil War', 'Berlin Wall', 'Great Depression', 'Vikings', 'Samurai', 'Middle Ages', 'Printing press',
  'RMS Titanic',
  // Culture, sport and tech
  'Mona Lisa', 'The Starry Night', 'Harry Potter', 'The Beatles', 'Star Wars', 'Minecraft', 'Pokémon',
  'Super Mario', 'Wikipedia', 'Google', 'Apple Inc.', 'Microsoft', 'Netflix', 'YouTube', 'Coca-Cola',
  'McDonald\'s', 'Lego', 'Rubik\'s Cube', 'Piano', 'Guitar', 'Jazz', 'Chess', 'Association football',
  'Basketball', 'Olympic Games', 'Democracy', 'Internet', 'Television', 'Bicycle', 'Airplane', 'Computer',
  'Artificial intelligence', 'Bitcoin', 'Mathematics', 'Philosophy', 'Music', 'Christianity', 'Islam',
  'Buddhism', 'Hinduism',
];

export const START_POOL: readonly string[] = [
  // Pop culture and everyday things everyone has heard of
  'Taylor Swift', 'Mickey Mouse', 'SpongeBob SquarePants', 'Spider-Man', 'Barbie', 'Darth Vader', 'Pikachu',
  'Shrek', 'Oprah Winfrey', 'Kim Kardashian', 'LeBron James', 'Justin Bieber', 'Donut', 'Instagram', 'TikTok',
  'Emoji', 'Selfie', 'Hot dog', 'Pancake', 'Popcorn', 'Bubble tea', 'Netflix', 'Disneyland', 'Santa Claus',
  'Easter Bunny', 'Halloween', 'Valentine\'s Day', 'Black Friday', 'Super Bowl', 'Oscar',
  // Odd objects, crafts and instruments
  'Kazoo', 'Theremin', 'Bagpipes', 'Accordion', 'Origami', 'Lava lamp', 'Typewriter', 'Zeppelin', 'Abacus',
  'Sundial', 'Igloo', 'Pagoda', 'Windmill', 'Hot air balloon', 'Steam engine', 'Telescope', 'Submarine',
  'Compass', 'Kaleidoscope', 'Harmonica', 'Ukulele', 'Didgeridoo', 'Bonsai', 'Pottery', 'Quilt',
  // Animals and plants
  'Capybara', 'Quokka', 'Tardigrade', 'Axolotl', 'Platypus', 'Narwhal', 'Pangolin', 'Flamingo', 'Komodo dragon',
  'Sloth', 'Meerkat', 'Red panda', 'Venus flytrap', 'Baobab', 'Sequoia sempervirens', 'Cactus', 'Orchid',
  // Games and sport
  'Curling', 'Sumo', 'Parkour', 'Skateboarding', 'Surfing', 'Marathon', 'Sudoku', 'Crossword', 'Backgammon',
  'Poker', 'Monopoly (game)', 'Scrabble', 'Dungeons & Dragons', 'Tetris', 'Pac-Man', 'Pong', 'Fencing',
  'Cricket', 'Rugby union', 'Ice hockey', 'Table tennis', 'Judo',
  // Food
  'Sourdough', 'Dim sum', 'Kimchi', 'Paella', 'Baklava', 'Falafel', 'Haggis', 'Fondue', 'Wasabi', 'Saffron',
  'Vanilla', 'Cinnamon', 'Black pepper', 'Espresso', 'Croissant', 'Tacos', 'Ramen', 'Curry', 'Doughnut',
  // Places
  'Mongolia', 'Bhutan', 'Luxembourg', 'Madagascar', 'Greenland', 'Tasmania', 'Patagonia', 'Siberia', 'Sicily',
  'Svalbard', 'Zanzibar', 'Timbuktu', 'Lake Baikal', 'Mariana Trench', 'Mount Etna', 'Krakatoa',
  'Atacama Desert', 'Galápagos Islands', 'Easter Island', 'Bermuda Triangle', 'Loch Ness', 'Chernobyl disaster',
  'Venice', 'Marrakesh', 'Reykjavík', 'Havana', 'Kyoto',
  // People
  'Ada Lovelace', 'Alan Turing', 'Grace Hopper', 'Rosalind Franklin', 'Galileo Galilei', 'Johannes Kepler',
  'Nicolaus Copernicus', 'Hypatia', 'Avicenna', 'Marco Polo', 'Ferdinand Magellan', 'Christopher Columbus',
  'Amelia Earhart', 'Sacagawea', 'Harriet Tubman', 'Frida Kahlo', 'Salvador Dalí', 'Edgar Allan Poe',
  'Mark Twain', 'Jane Austen', 'Leo Tolstoy', 'Homer', 'Dante Alighieri', 'Bob Marley', 'Freddie Mercury',
  'David Bowie', 'Johann Sebastian Bach', 'Frédéric Chopin', 'Antonio Vivaldi', 'Louis Armstrong', 'Miles Davis',
  'Fela Kuti', 'Cleopatra', 'Catherine the Great', 'Joan of Arc', 'Attila', 'Hannibal',
  // Myth and mystery
  'Bigfoot', 'Dragon', 'Unicorn', 'Vampire', 'Zombie', 'Mermaid', 'Kraken', 'Atlantis', 'Trojan Horse',
  'Minotaur', 'Excalibur', 'Stonehenge', 'Roswell incident',
  // Ideas, arts and tech
  'Haiku', 'Flamenco', 'Tango', 'Opera', 'Ballet', 'Bollywood', 'Anime', 'Comic book', 'Graffiti',
  'Cubism', 'Surrealism', 'Impressionism', 'Typography', 'Cryptography', 'Morse code', 'Telegraph', 'Radar',
  'Laser', 'Transistor', 'Microwave oven', 'Vacuum cleaner', 'Refrigerator', 'Elevator', 'Skyscraper',
  'Lighthouse', 'Aqueduct', 'Catapult', 'Longbow', 'Samurai', 'Gladiator', 'Pirate', 'Cowboy', 'Ninja',
];
