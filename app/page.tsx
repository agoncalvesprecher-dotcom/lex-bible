'use client';
// Removed force-static as it's a client component

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence, useScroll, useTransform } from 'motion/react';
import { GoogleGenAI } from "@google/genai";
import Image from 'next/image';
import ReactMarkdown from 'react-markdown';
import { saveChapter, getChapter, saveLexicon, getLexicon, getAllCachedChapters, clearAllCache, deleteCachedChapter, saveBibliology, getBibliology } from '@/lib/db';

// --- Types ---
type View = 'library' | 'read' | 'search' | 'settings' | 'translations' | 'original_languages' | 'notes' | 'favorites' | 'about' | 'feedback' | 'notifications' | 'canon_history' | 'offline_management';

type AppLanguage = 'pt_br' | 'pt_pt' | 'en' | 'es' | 'fr' | 'system';

interface FavoriteVerse {
  id: string;
  bookId: number;
  bookName: string;
  chapter: number;
  verse: number;
  text: string;
  color: string;
  createdAt: number;
}

interface Note {
  id: string;
  title: string;
  content: string;
  reference?: string;
  createdAt: number;
}

interface Verse {
  bookId: number;
  chapter: number;
  verse: number;
  text: string;
  reference: string;
}

interface Version {
  id: string;
  name: string;
  language: string;
  description: string;
}

interface Book {
  id: number;
  name: string;
  type: 'ot' | 'nt' | 'deuterocanon' | 'apocrypha_nt';
  caps: number;
  canons: ('protestant' | 'catholic' | 'orthodox' | 'historical')[];
  additions?: { id: number, name_key: string }[];
}

/*
interface ApocryphaBook {
  name: string;
  period: string;
}
*/

// --- Mock Data ---
const CANON_ORDER: Record<string, number[]> = {
  protestant: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66],
  catholic: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 101, 102, 106, 107, 18, 19, 20, 21, 22, 103, 104, 23, 24, 25, 105, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66],
  orthodox: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 108, 15, 16, 101, 102, 17, 106, 107, 109, 110, 19, 112, 111, 18, 20, 21, 22, 103, 104, 23, 24, 25, 105, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66],
  historical: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 201, 202, 203, 204, 205, 206, 207, 208, 209, 210, 211, 212, 213, 214, 218, 219, 220, 221, 222]
};

const getSortedBooks = (canon: string) => {
  const order = CANON_ORDER[canon] || CANON_ORDER.protestant;
  const filteredBooks = BIBLE_BOOKS.filter(b => 
    b.type === 'apocrypha_nt' || b.canons.includes(canon as 'protestant' | 'catholic' | 'orthodox' | 'historical')
  );
  
  return filteredBooks.sort((a, b) => {
    let indexA = order.indexOf(a.id);
    let indexB = order.indexOf(b.id);
    
    // If not in current canon order, check historical order for apocrypha
    if (indexA === -1) indexA = CANON_ORDER.historical.indexOf(a.id) + 1000;
    if (indexB === -1) indexB = CANON_ORDER.historical.indexOf(b.id) + 1000;
    
    return indexA - indexB;
  });
};
const BIBLE_BOOKS: Book[] = [
  // Antigo Testamento (Pentateuco)
  { id: 1, name: "Gênesis", type: "ot", caps: 50, canons: ['protestant', 'catholic', 'orthodox'] },
  { id: 2, name: "Êxodo", type: "ot", caps: 40, canons: ['protestant', 'catholic', 'orthodox'] },
  { id: 3, name: "Levítico", type: "ot", caps: 27, canons: ['protestant', 'catholic', 'orthodox'] },
  { id: 4, name: "Números", type: "ot", caps: 36, canons: ['protestant', 'catholic', 'orthodox'] },
  { id: 5, name: "Deuteronômio", type: "ot", caps: 34, canons: ['protestant', 'catholic', 'orthodox'] },

  // Históricos
  { id: 6, name: "Josué", type: "ot", caps: 24, canons: ['protestant', 'catholic', 'orthodox'] },
  { id: 7, name: "Juízes", type: "ot", caps: 21, canons: ['protestant', 'catholic', 'orthodox'] },
  { id: 8, name: "Rute", type: "ot", caps: 4, canons: ['protestant', 'catholic', 'orthodox'] },
  { id: 9, name: "1 Samuel", type: "ot", caps: 31, canons: ['protestant', 'catholic', 'orthodox'] },
  { id: 10, name: "2 Samuel", type: "ot", caps: 24, canons: ['protestant', 'catholic', 'orthodox'] },
  { id: 11, name: "1 Reis", type: "ot", caps: 22, canons: ['protestant', 'catholic', 'orthodox'] },
  { id: 12, name: "2 Reis", type: "ot", caps: 25, canons: ['protestant', 'catholic', 'orthodox'] },
  { id: 13, name: "1 Crônicas", type: "ot", caps: 29, canons: ['protestant', 'catholic', 'orthodox'] },
  { id: 14, name: "2 Crônicas", type: "ot", caps: 36, canons: ['protestant', 'catholic', 'orthodox'] },
  { id: 15, name: "Esdras", type: "ot", caps: 10, canons: ['protestant', 'catholic', 'orthodox'] },
  { id: 16, name: "Neemias", type: "ot", caps: 13, canons: ['protestant', 'catholic', 'orthodox'] },
  { id: 17, name: "Ester", type: "ot", caps: 10, canons: ['protestant', 'catholic', 'orthodox'], additions: [{ id: 171, name_key: 'addition_esther_greek' }] },

  // Poéticos e Sabedoria
  { id: 18, name: "Jó", type: "ot", caps: 42, canons: ['protestant', 'catholic', 'orthodox'] },
  { id: 19, name: "Salmos", type: "ot", caps: 150, canons: ['protestant', 'catholic', 'orthodox'] },
  { id: 20, name: "Provérbios", type: "ot", caps: 31, canons: ['protestant', 'catholic', 'orthodox'] },
  { id: 21, name: "Eclesiastes", type: "ot", caps: 12, canons: ['protestant', 'catholic', 'orthodox'] },
  { id: 22, name: "Cantares", type: "ot", caps: 8, canons: ['protestant', 'catholic', 'orthodox'] },

  // Profetas Maiores
  { id: 23, name: "Isaías", type: "ot", caps: 66, canons: ['protestant', 'catholic', 'orthodox'] },
  { id: 24, name: "Jeremias", type: "ot", caps: 52, canons: ['protestant', 'catholic', 'orthodox'] },
  { id: 25, name: "Lamentações", type: "ot", caps: 5, canons: ['protestant', 'catholic', 'orthodox'] },
  { id: 26, name: "Ezequiel", type: "ot", caps: 48, canons: ['protestant', 'catholic', 'orthodox'] },
  { id: 27, name: "Daniel", type: "ot", caps: 12, canons: ['protestant', 'catholic', 'orthodox'], additions: [
    { id: 215, name_key: 'addition_azarias' },
    { id: 216, name_key: 'addition_susana' },
    { id: 217, name_key: 'addition_bel_dragon' }
  ] },

  // Profetas Menores
  { id: 28, name: "Oseias", type: "ot", caps: 14, canons: ['protestant', 'catholic', 'orthodox'] },
  { id: 29, name: "Joel", type: "ot", caps: 3, canons: ['protestant', 'catholic', 'orthodox'] },
  { id: 30, name: "Amós", type: "ot", caps: 9, canons: ['protestant', 'catholic', 'orthodox'] },
  { id: 31, name: "Obadias", type: "ot", caps: 1, canons: ['protestant', 'catholic', 'orthodox'] },
  { id: 32, name: "Jonas", type: "ot", caps: 4, canons: ['protestant', 'catholic', 'orthodox'] },
  { id: 33, name: "Miqueias", type: "ot", caps: 7, canons: ['protestant', 'catholic', 'orthodox'] },
  { id: 34, name: "Naum", type: "ot", caps: 3, canons: ['protestant', 'catholic', 'orthodox'] },
  { id: 35, name: "Habacuque", type: "ot", caps: 3, canons: ['protestant', 'catholic', 'orthodox'] },
  { id: 36, name: "Sofonias", type: "ot", caps: 3, canons: ['protestant', 'catholic', 'orthodox'] },
  { id: 37, name: "Ageu", type: "ot", caps: 2, canons: ['protestant', 'catholic', 'orthodox'] },
  { id: 38, name: "Zacarias", type: "ot", caps: 14, canons: ['protestant', 'catholic', 'orthodox'] },
  { id: 39, name: "Malaquias", type: "ot", caps: 4, canons: ['protestant', 'catholic', 'orthodox'] },

  // Deuterocanônicos (Católico/Ortodoxo)
  { id: 101, name: "Tobias", type: "deuterocanon", caps: 14, canons: ['catholic', 'orthodox'] },
  { id: 102, name: "Judite", type: "deuterocanon", caps: 16, canons: ['catholic', 'orthodox'] },
  { id: 103, name: "Sabedoria", type: "deuterocanon", caps: 19, canons: ['catholic', 'orthodox'] },
  { id: 104, name: "Eclesiástico", type: "deuterocanon", caps: 51, canons: ['catholic', 'orthodox'] },
  { id: 105, name: "Baruque", type: "deuterocanon", caps: 6, canons: ['catholic', 'orthodox'] },
  { id: 106, name: "1 Macabeus", type: "deuterocanon", caps: 16, canons: ['catholic', 'orthodox'] },
  { id: 107, name: "2 Macabeus", type: "deuterocanon", caps: 15, canons: ['catholic', 'orthodox'] },
  
  // Exclusivos Ortodoxos
  { id: 108, name: "1 Esdras", type: "deuterocanon", caps: 9, canons: ['orthodox'] },
  { id: 109, name: "3 Macabeus", type: "deuterocanon", caps: 7, canons: ['orthodox'] },
  { id: 110, name: "4 Macabeus", type: "deuterocanon", caps: 18, canons: ['orthodox'] },
  { id: 111, name: "Oração de Manassés", type: "deuterocanon", caps: 1, canons: ['orthodox'] },
  { id: 112, name: "Salmo 151", type: "deuterocanon", caps: 1, canons: ['orthodox'] },

  // Novo Testamento (Evangelhos)
  { id: 40, name: "Mateus", type: "nt", caps: 28, canons: ['protestant', 'catholic', 'orthodox'] },
  { id: 41, name: "Marcos", type: "nt", caps: 16, canons: ['protestant', 'catholic', 'orthodox'] },
  { id: 42, name: "Lucas", type: "nt", caps: 24, canons: ['protestant', 'catholic', 'orthodox'] },
  { id: 43, name: "João", type: "nt", caps: 21, canons: ['protestant', 'catholic', 'orthodox'] },
  
  // História
  { id: 44, name: "Atos", type: "nt", caps: 28, canons: ['protestant', 'catholic', 'orthodox'] },

  // Epístolas Paulinas
  { id: 45, name: "Romanos", type: "nt", caps: 16, canons: ['protestant', 'catholic', 'orthodox'] },
  { id: 46, name: "1 Coríntios", type: "nt", caps: 16, canons: ['protestant', 'catholic', 'orthodox'] },
  { id: 47, name: "2 Coríntios", type: "nt", caps: 13, canons: ['protestant', 'catholic', 'orthodox'] },
  { id: 48, name: "Gálatas", type: "nt", caps: 6, canons: ['protestant', 'catholic', 'orthodox'] },
  { id: 49, name: "Efésios", type: "nt", caps: 6, canons: ['protestant', 'catholic', 'orthodox'] },
  { id: 50, name: "Filipenses", type: "nt", caps: 4, canons: ['protestant', 'catholic', 'orthodox'] },
  { id: 51, name: "Colossenses", type: "nt", caps: 4, canons: ['protestant', 'catholic', 'orthodox'] },
  { id: 52, name: "1 Tessalonicenses", type: "nt", caps: 5, canons: ['protestant', 'catholic', 'orthodox'] },
  { id: 53, name: "2 Tessalonicenses", type: "nt", caps: 3, canons: ['protestant', 'catholic', 'orthodox'] },
  { id: 54, name: "1 Timóteo", type: "nt", caps: 6, canons: ['protestant', 'catholic', 'orthodox'] },
  { id: 55, name: "2 Timóteo", type: "nt", caps: 4, canons: ['protestant', 'catholic', 'orthodox'] },
  { id: 56, name: "Tito", type: "nt", caps: 3, canons: ['protestant', 'catholic', 'orthodox'] },
  { id: 57, name: "Filemon", type: "nt", caps: 1, canons: ['protestant', 'catholic', 'orthodox'] },

  // Epístolas Gerais
  { id: 58, name: "Hebreus", type: "nt", caps: 13, canons: ['protestant', 'catholic', 'orthodox'] },
  { id: 59, name: "Tiago", type: "nt", caps: 5, canons: ['protestant', 'catholic', 'orthodox'] },
  { id: 60, name: "1 Pedro", type: "nt", caps: 5, canons: ['protestant', 'catholic', 'orthodox'] },
  { id: 61, name: "2 Pedro", type: "nt", caps: 3, canons: ['protestant', 'catholic', 'orthodox'] },
  { id: 62, name: "1 João", type: "nt", caps: 5, canons: ['protestant', 'catholic', 'orthodox'] },
  { id: 63, name: "2 João", type: "nt", caps: 1, canons: ['protestant', 'catholic', 'orthodox'] },
  { id: 64, name: "3 João", type: "nt", caps: 1, canons: ['protestant', 'catholic', 'orthodox'] },
  { id: 65, name: "Judas", type: "nt", caps: 1, canons: ['protestant', 'catholic', 'orthodox'] },

  // Profecia
  { id: 66, name: "Apocalipse", type: "nt", caps: 22, canons: ['protestant', 'catholic', 'orthodox'] },

  // Livros Históricos do Período Primitivo (Apócrifos/Questionados)
  { id: 201, name: "Didaquê", type: "apocrypha_nt", caps: 16, canons: ['historical'] },
  { id: 202, name: "1 Clemente", type: "apocrypha_nt", caps: 65, canons: ['historical'] },
  { id: 203, name: "Epístola de Barnabé", type: "apocrypha_nt", caps: 21, canons: ['historical'] },
  { id: 204, name: "Pastor de Hermas", type: "apocrypha_nt", caps: 27, canons: ['historical'] },
  { id: 205, name: "Apocalipse de Pedro", type: "apocrypha_nt", caps: 1, canons: ['historical'] },
  { id: 206, name: "Evangelho de Tomé", type: "apocrypha_nt", caps: 1, canons: ['historical'] },
  { id: 207, name: "Atos de Paulo e Tecla", type: "apocrypha_nt", caps: 1, canons: ['historical'] },
  { id: 208, name: "Epístola de Policarpo", type: "apocrypha_nt", caps: 14, canons: ['historical'] },
  { id: 209, name: "Epístola aos Laodicenses", type: "apocrypha_nt", caps: 1, canons: ['historical'] },
  { id: 210, name: "Evangelho de Filipe", type: "apocrypha_nt", caps: 1, canons: ['historical'] },
  { id: 211, name: "Evangelho de Maria Madalena", type: "apocrypha_nt", caps: 1, canons: ['historical'] },
  { id: 212, name: "Atos de Pedro", type: "apocrypha_nt", caps: 1, canons: ['historical'] },
  { id: 213, name: "Atos de João", type: "apocrypha_nt", caps: 1, canons: ['historical'] },
  { id: 214, name: "Apocalipse de Paulo", type: "apocrypha_nt", caps: 1, canons: ['historical'] },
  { id: 218, name: "Evangelho de Judas", type: "apocrypha_nt", caps: 1, canons: ['historical'] },
  { id: 219, name: "Apocalipse de Tiago", type: "apocrypha_nt", caps: 1, canons: ['historical'] },
  { id: 220, name: "Atos de Tomé", type: "apocrypha_nt", caps: 1, canons: ['historical'] },
  { id: 221, name: "Evangelho de Nicodemos", type: "apocrypha_nt", caps: 1, canons: ['historical'] },
  { id: 222, name: "Oração de Paulo", type: "apocrypha_nt", caps: 1, canons: ['historical'] },
];

const CANON_HISTORY: Record<string, Record<string, { title: string, content: string }>> = {
  pt_br: {
    protestant: {
      title: "História do Cânone Protestante",
      content: "O cânone protestante consiste em 39 livros do Antigo Testamento (seguindo o cânone judaico ou Tanakh) e 27 livros do Novo Testamento. Durante a Reforma Protestante no século XVI, reformadores como Martinho Lutero questionaram a autoridade dos livros deuterocanônicos (apócrifos), optando por retornar ao cânone hebraico para o Antigo Testamento, enquanto mantiveram o cânone tradicional do Novo Testamento estabelecido nos primeiros séculos da Igreja."
    },
    catholic: {
      title: "História do Cânone Católico",
      content: "O cânone católico foi formalmente definido no Concílio de Trento (1546), embora seguisse tradições muito mais antigas. Inclui 46 livros no Antigo Testamento (incluindo os deuterocanônicos como Tobias, Judite, Sabedoria, Eclesiástico, Baruque e 1 e 2 Macabeus) e 27 no Novo Testamento. A Igreja Católica baseou seu Antigo Testamento na Septuaginta (LXX), a tradução grega usada pelos primeiros cristãos."
    },
    orthodox: {
      title: "História do Cânone Ortodoxo",
      content: "As igrejas ortodoxas orientais possuem o cânone mais extenso. Além dos livros do cânone católico, incluem livros adicionais como 1 Esdras, 3 Macabeus, a Oração de Manassés e o Salmo 151. O 4 Macabeus é frequentemente incluído como um apêndice. Esta diversidade reflete a aceitação de várias tradições regionais e manuscritos da Septuaginta que circularam no Oriente cristão."
    },
    historical: {
      title: "História da Canonização e Apócrifos",
      content: "A história da canonização é um processo complexo de séculos. Muitos livros que hoje são considerados 'apócrifos' (ocultos) foram lidos e respeitados por comunidades cristãs primitivas. Livros como o 'Pastor de Hermas' ou a 'Didaquê' quase entraram no cânone do Novo Testamento. Por outro lado, livros como 'Laodicenses' circularam em algumas versões da Vulgata Latina por séculos antes de serem definitivamente excluídos. O processo de 'Apócrifização' muitas vezes dependia da conformidade doutrinária e da aceitação universal pelas igrejas apostólicas."
    }
  },
  pt_pt: {
    protestant: {
      title: "História do Cânone Protestante",
      content: "O cânone protestante consiste em 39 livros do Antigo Testamento (seguindo o cânone judaico ou Tanakh) e 27 livros do Novo Testamento. Durante a Reforma Protestante no século XVI, reformadores como Martinho Lutero questionaram a autoridade dos livros deuterocanónicos (apócrifos), optando por retornar ao cânone hebraico para o Antigo Testamento, enquanto mantiveram o cânone tradicional do Novo Testamento estabelecido nos primeiros séculos da Igreja."
    },
    catholic: {
      title: "História do Cânone Católico",
      content: "O cânone católico foi formalmente definido no Concílio de Trento (1546), embora seguisse tradições muito mais antigas. Inclui 46 livros no Antigo Testamento (incluindo os deuterocanónicos como Tobias, Judite, Sabedoria, Eclesiástico, Baruque e 1 e 2 Macabeus) e 27 no Novo Testamento. A Igreja Católica baseou o seu Antigo Testamento na Septuaginta (LXX), a tradução grega usada pelos primeiros cristãos."
    },
    orthodox: {
      title: "História do Cânone Ortodoxo",
      content: "As igrejas ortodoxas orientais possuem o cânone mais extenso. Além dos livros do cânone católico, incluem livros adicionais como 1 Esdras, 3 Macabeus, a Oração de Manassés e o Salmo 151. O 4 Macabeus é frequentemente incluído como um apêndice. Esta diversidade reflete a aceitação de várias tradições regionais e manuscritos da Septuaginta que circularam no Oriente cristão."
    },
    historical: {
      title: "História da Canonização e Apócrifos",
      content: "A história da canonização é um processo complexo de séculos. Muitos livros que hoje são considerados 'apócrifos' (ocultos) foram lidos e respeitados por comunidades cristãs primitivas. Livros como o 'Pastor de Hermas' ou a 'Didaquê' quase entraram no cânone do Novo Testamento. Por outro lado, livros como 'Laodicenses' circularam em algumas versões da Vulgata Latina por séculos antes de serem definitivamente excluídos. O processo de 'Apócrifização' muitas vezes dependia da conformidade doutrinária e da aceitação universal pelas igrejas apostólicas."
    }
  },
  en: {
    protestant: {
      title: "Protestant Canon History",
      content: "The Protestant canon consists of 39 books of the Old Testament (following the Jewish canon or Tanakh) and 27 books of the New Testament. During the 16th-century Protestant Reformation, reformers like Martin Luther questioned the authority of the deuterocanonical (apocryphal) books, opting to return to the Hebrew canon for the Old Testament while maintaining the traditional New Testament canon established in the early centuries of the Church."
    },
    catholic: {
      title: "Catholic Canon History",
      content: "The Catholic canon was formally defined at the Council of Trent (1546), although it followed much older traditions. It includes 46 books in the Old Testament (including the deuterocanonical books like Tobit, Judith, Wisdom, Sirach, Baruch, and 1 and 2 Maccabees) and 27 in the New Testament. The Catholic Church based its Old Testament on the Septuagint (LXX), the Greek translation used by early Christians."
    },
    orthodox: {
      title: "Orthodox Canon History",
      content: "Eastern Orthodox churches have the most extensive canon. In addition to the books of the Catholic canon, they include additional books such as 1 Esdras, 3 Maccabees, the Prayer of Manasseh, and Psalm 151. 4 Maccabees is often included as an appendix. This diversity reflects the acceptance of various regional traditions and Septuagint manuscripts that circulated in the Christian East."
    },
    historical: {
      title: "Canonization and Apocrypha History",
      content: "The history of canonization is a complex process spanning centuries. Many books considered 'apocryphal' (hidden) today were read and respected by early Christian communities. Books like the 'Shepherd of Hermas' or the 'Didache' almost entered the New Testament canon. Conversely, books like 'Laodiceans' circulated in some versions of the Latin Vulgate for centuries before being definitively excluded. The process of 'Apocryphization' often depended on doctrinal conformity and universal acceptance by apostolic churches."
    }
  },
  es: {
    protestant: {
      title: "Historia del Canon Protestante",
      content: "El canon protestante consta de 39 libros del Antiguo Testamento (siguiendo el canon judío o Tanakh) y 27 libros del Nuevo Testamento. Durante la Reforma Protestante del siglo XVI, reformadores como Martín Lutero cuestionaron la autoridad de los libros deuterocanónicos (apócrifos), optando por regresar al canon hebreo para el Antiguo Testamento mientras mantenían el canon tradicional del Nuevo Testamento establecido en los primeros siglos de la Iglesia."
    },
    catholic: {
      title: "Historia del Canon Católico",
      content: "El canon católico fue definido formalmente en el Concilio de Trento (1546), aunque siguió tradiciones mucho más antiguas. Incluye 46 libros en el Antiguo Testamento (incluyendo los libros deuterocanónicos como Tobías, Judit, Sabiduría, Eclesiástico, Baruc y 1 y 2 Macabeos) y 27 en el Nuevo Testamento. La Iglesia Católica basó su Antiguo Testamento en la Septuaginta (LXX), la traducción griega utilizada por los primeros cristianos."
    },
    orthodox: {
      title: "Historia del Canon Ortodoxo",
      content: "Las iglesias ortodoxas orientales tienen el canon más extenso. Además de los libros del canon católico, incluyen libros adicionales como 1 Esdras, 3 Macabeos, la Oración de Manasés y el Salmo 151. El 4 Macabeos se incluye a menudo como un apéndice. Esta diversidad refleja la aceptación de varias tradiciones regionales y manuscritos de la Septuaginta que circularon en el Oriente cristiano."
    },
    historical: {
      title: "Historia de la Canonización y Apócrifos",
      content: "La historia de la canonización es un proceso complejo de siglos. Muchos libros que hoy se consideran 'apócrifos' (ocultos) fueron leídos y respetados por las comunidades cristianas primitivas. Libros como el 'Pastor de Hermas' o la 'Didaché' casi entraron en el canon del Nuevo Testamento. Por otro lado, libros como 'Laodicenses' circularon en algunas versiones de la Vulgata Latina durante siglos antes de ser definitivamente excluidos. El proceso de 'Apocrifización' a menudo dependía de la conformidad doctrinal y la aceptación universal por parte de las iglesias apostólicas."
    }
  },
  fr: {
    protestant: {
      title: "Histoire du Canon Protestant",
      content: "Le canon protestant se compose de 39 livres de l'Ancien Testament (suivant le canon juif ou Tanakh) et de 27 livres du Nouveau Testament. Lors de la Réforme protestante du XVIe siècle, des réformateurs comme Martin Luther ont remis en question l'autorité des livres deutérocanoniques (apocryphes), choisissant de revenir au canon hébreu pour l'Ancien Testament tout en conservant le canon traditionnel du Nouveau Testament établi au cours des premiers siècles de l'Église."
    },
    catholic: {
      title: "Histoire du Canon Catholique",
      content: "Le canon catholique a été formellement défini au concile de Trente (1546), bien qu'il ait suivi des traditions beaucoup plus anciennes. Il comprend 46 livres dans l'Ancien Testament (y compris les livres deutérocanoniques comme Tobie, Judith, la Sagesse, l'Ecclésiastique, Baruch et 1 et 2 Maccabées) et 27 dans le Nouveau Testament. L'Église catholique a basé son Ancien Testament sur la Septante (LXX), la traduction grecque utilisée par les premiers chrétiens."
    },
    orthodox: {
      title: "Histoire du Canon Orthodoxe",
      content: "Les églises orthodoxes orientales possèdent le canon le plus étendu. En plus des livres du canon catholique, elles incluent des livres supplémentaires tels que 1 Esdras, 3 Maccabées, la Prière de Manassé et le Psaume 151. Le 4 Maccabées est souvent inclus en annexe. Cette diversité reflète l'acceptation de diverses traditions régionales et de manuscrits de la Septante qui circulaient dans l'Orient chrétien."
    },
    historical: {
      title: "Histoire de la Canonisation et des Apocryphes",
      content: "L'histoire de la canonisation est un processus complexe s'étendant sur des siècles. De nombreux livres considérés aujourd'hui comme « apocryphes » (cachés) étaient lus et respectés par les premières communautés chrétiennes. Des livres comme le « Pasteur d'Hermas » ou la « Didachè » ont failli entrer dans le canon du Nouveau Testament. Inversement, des livres comme « Laodicéens » ont circulé dans certaines versions de la Vulgate latine pendant des siècles avant d'être définitivement exclus. Le processus d'« apocryphisation » dépendait souvent de la conformité doctrinale et de l'acceptation universelle par les églises apostoliques."
    }
  }
};

const UI_STRINGS: Record<string, Record<string, string | Record<number, string>>> = {
  pt_br: {
    library: "Biblioteca",
    read: "Leitura",
    search: "Pesquisa",
    settings: "Configurações",
    translations: "Traduções",
    original_languages: "Línguas Originais",
    notes: "Anotações",
    favorites: "Favoritos",
    history_btn: "História do Cânone",
    apocrypha_history: "História da Canonização",
    all: "Todos",
    search_placeholder: "O que você procura hoje?",
    download_all: "Baixar Tudo",
    clear_cache: "Limpar Tudo",
    language: "Idioma da Aplicação",
    system: "Sistema",
    font_size: "Tamanho da Tipografia",
    font_family: "Tipo de Letra",
    theme: "Tema e Cor",
    offline_manager: "Gerenciar Offline",
    download_book: "Baixar Livro",
    download_version: "Baixar Versão",
    search_versions: "Pesquisar mais versões",
    no_notes: "Nenhuma nota ainda.",
    no_favorites: "Nenhum favorito ainda.",
    save: "Salvar",
    delete: "Excluir",
    edit: "Editar",
    app_title: "LEX BIBLE",
    tagline: "Escrituras Sagradas",
    ot_title: "Antigo Testamento",
    ot_subtitle: "A Lei, os Profetas e os Escritos",
    nt_title: "Novo Testamento",
    nt_subtitle: "Os Evangelhos e as Epístolas Apostólicas",
    apocrypha_title: "Livros Históricos do Período Primitivo",
    apocrypha_subtitle: "Escritos da Era Apostólica e Pós-Apostólica",
    deuterocanon_title: "Livros Deuterocanônicos",
    chapters_label: "Capítulos",
    chapter_label: "Capítulo",
    versicles_label: "Versículos",
    versicle_label: "Versículo",
    downloading_version: "Baixando {0}...",
    download_complete: "Download de {0} concluído!",
    feedback_thanks: "Obrigado pelo seu feedback!",
    link_copied: "Link copiado para a área de transferência!",
    favorite_added: "Versículo favoritado!",
    favorite_removed: "Favorito removido!",
    share_text: "Confira este aplicativo incrível para estudo bíblico!",
    current_version: "Versão atual: {0}",
    bible_canon: "Cânone Bíblico",
    protestant: "Protestante",
    catholic: "Católico",
    orthodox: "Ortodoxo",
    fluent_verse: "Versículo Fluente",
    daily_verse: "Versículo do Dia",
    loading_meditation: "Carregando meditação diária...",
    deuterocanon_label: "Deuterocanônico",
    select_book: "Selecione um Livro",
    select_chapter: "Selecione o Capítulo",
    downloading: "Baixando...",
    download_full_book: "Baixar Livro Completo",
    offline: "Offline",
    online: "Online",
    refresh_cache: "Recarregar e Atualizar Cache",
    stop_reading: "Parar Leitura",
    start_reading: "Ler em Voz Alta",
    fetching_scriptures: "Buscando escrituras...",
    scripture_exploration: "Exploração das Escrituras",
    deep_search: "Pesquisa Profunda",
    deep_search_desc: "Sonde as profundezas da Palavra de Deus por temas, palavras-chave ou referências específicas.",
    search_placeholder_deep: "O que você procura hoje? (ex: Amor, Fé, Salvação)",
    search_btn: "Pesquisar",
    suggested_themes: "Temas Sugeridos",
    study_tip: "Dica de Estudo",
    study_tip_desc: "Use palavras-chave específicas ou temas teológicos para encontrar conexões entre o Antigo e o Novo Testamento.",
    searching_scriptures: "Sondando as escrituras...",
    seeking_wisdom: "Buscando sabedoria eterna",
    click_to_read: "Clique para ler o capítulo completo",
    no_results: "Nenhum resultado encontrado para sua busca.",
    clear_search: "Limpar pesquisa",
    customization: "Customização",
    customization_desc: "Personalize sua experiência de leitura para a santidade da palavra.",
    reset: "Resetar",
    text_preview: "Pré-visualização do Texto",
    preview_verse: "No princípio era o Verbo, e o Verbo estava com Deus, e o Verbo era Deus.",
    preview_ref: "João 1:1",
    bible_mode: "Modo da Bíblia",
    bible_mode_desc: "Selecione o cânone bíblico para organizar os livros da sua biblioteca.",
    interface_appearance: "Aparência da Interface",
    theme_mode: "Modo de Tema",
    light: "Claro",
    dark: "Escuro",
    accent_color: "Cor de Destaque",
    tts_settings: "Leitura em Voz Alta (TTS)",
    voice_speed: "Velocidade da Voz",
    voice_pitch: "Tom da Voz",
    voice: "Voz",
    device_voice: "Voz do Dispositivo",
    default_voice: "Voz Padrão",
    stored_content: "Conteúdo Armazenado",
    stored_content_desc: "Capítulos e significados originais salvos.",
    cache_cleared: "Cache limpo!",
    current_book: "Livro Atual",
    download_book_desc: "Baixe todos os capítulos de {book}.",
    full_translation: "Tradução Completa",
    download_translation_desc: "Baixe toda a versão {version} (66 livros).",
    downloaded_chapters: "Capítulos Baixados ({count})",
    no_chapters_saved: "Nenhum capítulo salvo ainda.",
    lamp_verse: "Lâmpada para os meus pés é tua palavra, e luz para o meu caminho.",
    lamp_ref: "Salmos 119:105",
    select_version_desc: "Selecione sua versão preferida das Escrituras.",
    download_full_translation: "Baixar Tradução Completa",
    original_languages_desc: "Acesse os textos sagrados em Hebraico, Aramaico e Grego.",
    menu: "Menu",
    notifications: "Notificações",
    share_app: "Partilhar aplicação",
    about_dev: "Sobre o desenvolvedor",
    send_feedback: "Enviar feedback",
    notes_title: "Anotações",
    new_note: "Nova Nota",
    no_reference: "Sem referência",
    note_title_placeholder: "Título da nota...",
    note_content_placeholder: "Comece a escrever sua reflexão...",
    confirm_delete_note: "Deseja excluir esta nota?",
    note_deleted: "Nota excluída!",
    note_saved_auto: "Nota salva automaticamente!",
    select_or_create_note: "Selecione ou crie uma nota para começar.",
    favorites_title: "Favoritos",
    category: "Categoria",
    confirm_remove_favorite: "Remover dos favoritos?",
    removed: "Removido!",
    dev_name: "Augusto Gonçalves",
    dev_title: "(Desenvolvedor e Pregador do Evangelho de Cristo Jesus)",
    dev_bio: "Dedicado à promoção do conhecimento e ao aprofundamento da compreensão das Escrituras e da espiritualidade cristã, procuro criar ferramentas que tornem a Palavra acessível a todos, em qualquer lugar.",
    dev_email: "augustogoncalvesapostly@gmail.com",
    dev_whatsapp: "+244 972 664 768",
    dev_facebook: "Augusto Gonçalves",
    dev_whatsapp_url: "https://wa.me/244972664768",
    dev_facebook_url: "https://www.facebook.com/shala.augusto.goncalves",
    notifications_subtitle: "Mantenha-se conectado com a Palavra ao longo do dia.",
    enable_notifications: "Ativar Notificações",
    enable_notifications_desc: "Receba alertas e versículos no seu dispositivo.",
    fluent_widget: "Widget de Versículos Fluentes",
    fluent_widget_desc: "Exibe versículos periódicos na sua tela principal.",
    daily_reminder: "Lembrete Diário de Leitura",
    daily_reminder_desc: "Receba um lembrete para ler a Bíblia todos os dias.",
    reminder_time: "Horário do Lembrete",
    notifications_active_msg: "As notificações estão ativas. Você receberá uma porção da Palavra a cada hora.",
    notification_test: "Teste de Notificação",
    test_notification_now: "Testar Notificação Agora",
    back_to_library: "Voltar para a Biblioteca",
    consulting_lexicons: "Consultando léxicos originais...",
    books: "Livros",
    reading: "Leitura",
    feedback_placeholder: "Escreva sua mensagem aqui...",
    send_message: "Enviar Mensagem",
    confirm_action: "Confirmar Ação",
    cancel: "Cancelar",
    confirm: "Confirmar",
    versions_found: "Novas versões encontradas!",
    versions_error: "Erro ao buscar versões.",
    exit_fullscreen: "Sair da Tela Cheia",
    enter_fullscreen: "Tela Cheia",
    default: "Padrão",
    copy: "Copiar",
    note: "Nota",
    note_in: "Nota em",
    clear: "Limpar",
    select_chapter_to_read: "Selecione um capítulo para iniciar a leitura.",
    tag_love: "Amor",
    tag_forgiveness: "Perdão",
    tag_hope: "Esperança",
    tag_justice: "Justiça",
    tag_peace: "Paz",
    tag_wisdom: "Sabedoria",
    tag_creation: "Criação",
    tag_redemption: "Redenção",
    confirm_download_book: "Deseja baixar todos os {0} capítulos de {1} para uso offline? Isso pode levar alguns minutos.",
    download_book_success: "{0} baixado com sucesso! {1} capítulos salvos.",
    download_book_error: "Ocorreu um erro ao baixar alguns capítulos.",
    confirm_download_version: "Deseja baixar a tradução completa \"{0}\" para uso offline? Isso pode levar alguns minutos.",
    download_progress: "Progresso: {0}%",
    download_complete_count: "Download de {0} concluído! {1} capítulos salvos.",
    lexicon_error: "Erro ao buscar informações lexicais.",
    lexicon_loading: "Buscando informações léxicas...",
    lexicon_study: "Estudo Lexicográfico",
    lexicon_meaning: "Significado Exegético",
    lexicon_grammar: "Análise Gramatical",
    lexicon_context: "Contexto Histórico",
    lexicon_connections: "Conexões Linguísticas",
    lexicon_applications: "Aplicações e Usos",
    lexicon_footer: "Léxico Acadêmico Profundo",
    verse_of_the_moment: "Versículo do Momento",
    lexicon_pronunciation: "Pronúncia",
    lexicon_primary_root: "Raiz Primária",
    lexicon_lxx_greek: "Septuaginta (LXX) / Grego",
    lexicon_biblical_aramaic: "Aramaico Bíblico",
    reading_reminder: "Lembrete de Leitura",
    reading_reminder_body: "É hora da sua meditação diária nas Escrituras.",
    chapter_content_fallback_1: "Conteúdo do capítulo {0} de {1} (Simulação).",
    chapter_content_fallback_2: "Para visualizar o texto real, certifique-se de que a chave API está configurada.",
    version_label: "Versão",
    font_manuscript: "Manuscrito",
    font_bold: "Negritos",
    notifications_enabled: "Notificações Ativadas",
    notifications_enabled_body: "Você receberá versículos diários e atualizações.",
    notification_permission_denied: "Permissão de notificação negada.",
    notifications_not_supported: "Este navegador não suporta notificações.",
    app_installed_success: "Aplicação instalada com sucesso!",
    addition_esther_greek: "Adições Gregas",
    addition_azarias: "Oração de Azarias",
    addition_susana: "Susana",
    addition_bel_dragon: "Bel e o Dragão",
    with_additions: "com adições",
    greek_additions: "adições gregas",
    tts_not_supported: "Leitura em voz alta não suportada neste navegador.",
    canon_history_title: "História do Cânone",
    feedback_title: "Sua opinião importa",
    feedback_subtitle: "Como podemos melhorar sua experiência de estudo?",
    translation_kjv_desc: "Tradução clássica e autorizada.",
    translation_jfa_desc: "A versão mais tradicional em português.",
    translation_niv_desc: "Linguagem moderna e clara.",
    translation_nvi_desc: "Equilíbrio entre fidelidade e clareza.",
    translation_rv_desc: "A versão clássica em espanhol.",
    translation_lsg_desc: "A versão de referência em francês.",
    translation_vkj_pt_desc: "Tradução fiel aos textos originais.",
    translation_vkj_fr_desc: "Tradução fiel aos textos originais.",
    translation_vkj_es_desc: "Tradução fiel aos textos originais.",
    translation_hebrew_desc: "O Antigo Testamento em sua língua original.",
    translation_aramaic_desc: "Textos em aramaico antigo.",
    translation_greek_desc: "O Novo Testamento em Grego Koiné.",
    lang_english: "Inglês",
    lang_portuguese: "Português",
    lang_portuguese_br: "Português (Brasil)",
    lang_portuguese_pt: "Português (Portugal)",
    lang_spanish: "Espanhol",
    lang_french: "Francês",
    lang_hebrew: "Hebraico",
    lang_aramaic: "Aramaico",
    lang_greek: "Grego",
    color_gold: "Dourado",
    color_emerald: "Esmeralda",
    color_ruby: "Rubi",
    color_earth: "Terra",
    color_black: "Preto",
    color_white: "Branco",
    bibliology_btn: "Bibliologia",
    bibliology_title: "Bibliologia: {0}",
    bibliology_loading: "Sondando a história do livro...",
    bibliology_error: "Não foi possível carregar a bibliologia.",
    show_apocrypha: "Apócrifos",
    hide_apocrypha: "Esconder Apócrifos",
    book_names: {
      1: "Gênesis", 2: "Êxodo", 3: "Levítico", 4: "Números", 5: "Deuteronômio",
      6: "Josué", 7: "Juízes", 8: "Rute", 9: "1 Samuel", 10: "2 Samuel",
      11: "1 Reis", 12: "2 Reis", 13: "1 Crônicas", 14: "2 Crônicas",
      15: "Esdras", 16: "Neemias", 17: "Ester", 18: "Jó", 19: "Salmos",
      20: "Provérbios", 21: "Eclesiastes", 22: "Cantares", 23: "Isaías",
      24: "Jeremias", 25: "Lamentações", 26: "Ezequiel", 27: "Daniel",
      28: "Oseias", 29: "Joel", 30: "Amós", 31: "Obadias", 32: "Jonas",
      33: "Miqueias", 34: "Naum", 35: "Habacuque", 36: "Sofonias",
      37: "Ageu", 38: "Zacarias", 39: "Malaquias",
      40: "Mateus", 41: "Marcos", 42: "Lucas", 43: "João", 44: "Atos",
      45: "Romanos", 46: "1 Coríntios", 47: "2 Coríntios", 48: "Gálatas",
      49: "Efésios", 50: "Filipenses", 51: "Colossenses", 52: "1 Tessalonicenses",
      53: "2 Tessalonicenses", 54: "1 Timóteo", 55: "2 Timóteo", 56: "Tito",
      57: "Filemom", 58: "Hebreus", 59: "Tiago", 60: "1 Pedro", 61: "2 Pedro",
      62: "1 João", 63: "2 João", 64: "3 João", 65: "Judas", 66: "Apocalipse",
      101: "Tobias", 102: "Judite", 103: "Sabedoria", 104: "Eclesiástico",
      105: "Baruque", 106: "1 Macabeus", 107: "2 Macabeus", 108: "1 Esdras",
      109: "3 Macabeus", 110: "4 Macabeus", 111: "Oração de Manassés", 112: "Salmo 151",
      201: "Didaquê", 202: "1 Clemente", 203: "Epístola de Barnabé", 204: "Pastor de Hermas",
      205: "Apocalipse de Pedro", 206: "Evangelho de Tomé", 207: "Atos de Paulo e Tecla",
      208: "Epístola de Policarpo", 209: "Epístola aos Laodicenses", 210: "Evangelho de Filipe",
      211: "Evangelho de Maria Madalena", 212: "Atos de Pedro", 213: "Atos de João",
      214: "Apocalipse de Paulo", 215: "Oração de Azarias", 216: "Susana",
      217: "Bel e o Dragão", 218: "Evangelho de Judas", 219: "Apocalipse de Tiago",
      220: "Atos de Tomé", 221: "Evangelho de Nicodemos", 222: "Oração de Paulo"
    }
  },
  pt_pt: {
    library: "Biblioteca",
    read: "Leitura",
    search: "Pesquisa",
    settings: "Definições",
    translations: "Traduções",
    original_languages: "Línguas Originais",
    notes: "Anotações",
    favorites: "Favoritos",
    history_btn: "História do Cânone",
    apocrypha_history: "História da Canonização",
    all: "Todos",
    search_placeholder: "O que procura hoje?",
    download_all: "Descarregar Tudo",
    clear_cache: "Limpar Tudo",
    language: "Idioma da Aplicação",
    system: "Sistema",
    font_size: "Tamanho da Tipografia",
    font_family: "Tipo de Letra",
    theme: "Tema e Cor",
    offline_manager: "Gerir Offline",
    download_book: "Descarregar Livro",
    download_version: "Descarregar Versão",
    search_versions: "Pesquisar mais versões",
    no_notes: "Nenhuma nota ainda.",
    no_favorites: "Nenhum favorito ainda.",
    save: "Guardar",
    delete: "Eliminar",
    edit: "Editar",
    app_title: "LEX BIBLE",
    tagline: "Escrituras Sagradas",
    ot_title: "Antigo Testamento",
    ot_subtitle: "A Lei, os Profetas e os Escritos",
    nt_title: "Novo Testamento",
    nt_subtitle: "Os Evangelhos e as Epístolas Apostólicas",
    apocrypha_title: "Livros Históricos do Período Primitivo",
    apocrypha_subtitle: "Escritos da Era Apostólica e Pós-Apostólica",
    deuterocanon_title: "Livros Deuterocanónicos",
    chapters_label: "Capítulos",
    chapter_label: "Capítulo",
    versicles_label: "Versículos",
    versicle_label: "Versículo",
    downloading_version: "A descarregar {0}...",
    download_complete: "Descarregamento de {0} concluído!",
    feedback_thanks: "Obrigado pelo seu feedback!",
    link_copied: "Link copiado para a área de transferência!",
    favorite_added: "Versículo favoritado!",
    favorite_removed: "Favorito removido!",
    share_text: "Confira esta aplicação incrível para estudo bíblico!",
    current_version: "Versão atual: {0}",
    bible_canon: "Cânone Bíblico",
    protestant: "Protestante",
    catholic: "Católico",
    orthodox: "Ortodoxo",
    fluent_verse: "Versículo Fluente",
    daily_verse: "Versículo do Dia",
    loading_meditation: "A carregar meditação diária...",
    deuterocanon_label: "Deuterocanónico",
    select_book: "Selecione um Livro",
    select_chapter: "Selecione o Capítulo",
    downloading: "A descarregar...",
    download_full_book: "Descarregar Livro Completo",
    offline: "Offline",
    online: "Online",
    refresh_cache: "Recarregar e Atualizar Cache",
    stop_reading: "Parar Leitura",
    start_reading: "Ler em Voz Alta",
    fetching_scriptures: "A procurar escrituras...",
    scripture_exploration: "Exploração das Escrituras",
    deep_search: "Pesquisa Profunda",
    deep_search_desc: "Sonde as profundezas da Palavra de Deus por temas, palavras-chave ou referências específicas.",
    search_placeholder_deep: "O que procura hoje? (ex: Amor, Fé, Salvação)",
    search_btn: "Pesquisar",
    suggested_themes: "Temas Sugeridos",
    study_tip: "Dica de Estudo",
    study_tip_desc: "Utilize palavras-chave específicas ou temas teológicos para encontrar ligações entre o Antigo e o Novo Testamento.",
    searching_scriptures: "A sondar as escrituras...",
    seeking_wisdom: "A procurar sabedoria eterna",
    click_to_read: "Clique para ler o capítulo completo",
    no_results: "Nenhum resultado encontrado para a sua busca.",
    clear_search: "Limpar pesquisa",
    customization: "Personalização",
    customization_desc: "Personalize a sua experiência de leitura para a santidade da palavra.",
    reset: "Repor",
    text_preview: "Pré-visualização do Texto",
    preview_verse: "No princípio era o Verbo, e o Verbo estava com Deus, e o Verbo era Deus.",
    preview_ref: "João 1:1",
    bible_mode: "Modo da Bíblia",
    bible_mode_desc: "Selecione o cânone bíblico para organizar os livros da sua biblioteca.",
    interface_appearance: "Aparência da Interface",
    theme_mode: "Modo de Tema",
    light: "Claro",
    dark: "Escuro",
    accent_color: "Cor de Destaque",
    tts_settings: "Leitura em Voz Alta (TTS)",
    voice_speed: "Velocidade da Voz",
    voice_pitch: "Tom da Voz",
    voice: "Voz",
    device_voice: "Voz do Dispositivo",
    default_voice: "Voz Padrão",
    stored_content: "Conteúdo Armazenado",
    stored_content_desc: "Capítulos e significados originais guardados.",
    cache_cleared: "Cache limpo!",
    current_book: "Livro Atual",
    download_book_desc: "Descarregue todos os capítulos de {book}.",
    full_translation: "Tradução Completa",
    download_translation_desc: "Descarregue toda a versão {version} (66 livros).",
    downloaded_chapters: "Capítulos Descarregados ({count})",
    no_chapters_saved: "Nenhum capítulo guardado ainda.",
    lamp_verse: "Lâmpada para os meus pés é a tua palavra, e luz para o meu caminho.",
    lamp_ref: "Salmos 119:105",
    select_version_desc: "Selecione a sua versão preferida das Escrituras.",
    download_full_translation: "Descarregar Tradução Completa",
    original_languages_desc: "Aceda aos textos sagrados em Hebraico, Aramaico e Grego.",
    menu: "Menu",
    notifications: "Notificações",
    share_app: "Partilhar aplicação",
    about_dev: "Sobre o desenvolvedor",
    send_feedback: "Enviar feedback",
    notes_title: "Anotações",
    new_note: "Nova Nota",
    no_reference: "Sem referência",
    note_title_placeholder: "Título da nota...",
    note_content_placeholder: "Comece a escrever a sua reflexão...",
    confirm_delete_note: "Deseja eliminar esta nota?",
    note_deleted: "Nota eliminada!",
    note_saved_auto: "Nota guardada automaticamente!",
    select_or_create_note: "Selecione ou crie uma nota para começar.",
    favorites_title: "Favoritos",
    category: "Categoria",
    confirm_remove_favorite: "Remover dos favoritos?",
    removed: "Removido!",
    dev_name: "Augusto Gonçalves",
    dev_title: "(Desenvolvedor e Pregador do Evangelho de Cristo Jesus)",
    dev_bio: "Dedicado à promoção do conhecimento e ao aprofundamento da compreensão das Escrituras e da espiritualidade cristã, procuro criar ferramentas que tornem a Palavra acessível a todos, em qualquer lugar.",
    dev_email: "augustogoncalvesapostly@gmail.com",
    dev_whatsapp: "+244 972 664 768",
    dev_facebook: "Augusto Gonçalves",
    dev_whatsapp_url: "https://wa.me/244972664768",
    dev_facebook_url: "https://www.facebook.com/shala.augusto.goncalves",
    notifications_subtitle: "Mantenha-se ligado com a Palavra ao longo do dia.",
    enable_notifications: "Ativar Notificações",
    enable_notifications_desc: "Receba alertas e versículos no seu dispositivo.",
    fluent_widget: "Widget de Versículos Fluentes",
    fluent_widget_desc: "Exibe versículos periódicos no seu ecrã principal.",
    daily_reminder: "Lembrete Diário de Leitura",
    daily_reminder_desc: "Receba um lembrete para ler a Bíblia todos os dias.",
    reminder_time: "Horário do Lembrete",
    notifications_active_msg: "As notificações estão ativas. Receberá uma porção da Palavra a cada hora.",
    notification_test: "Teste de Notificação",
    test_notification_now: "Testar Notificação Agora",
    back_to_library: "Voltar para a Biblioteca",
    consulting_lexicons: "A consultar léxicos originais...",
    books: "Livros",
    reading: "Leitura",
    feedback_placeholder: "Escreva a sua mensagem aqui...",
    send_message: "Enviar Mensagem",
    confirm_action: "Confirmar Ação",
    cancel: "Cancelar",
    confirm: "Confirmar",
    versions_found: "Novas versões encontradas!",
    versions_error: "Erro ao procurar versões.",
    exit_fullscreen: "Sair do Ecrã Inteiro",
    enter_fullscreen: "Ecrã Inteiro",
    default: "Padrão",
    copy: "Copiar",
    note: "Nota",
    note_in: "Nota em",
    clear: "Limpar",
    select_chapter_to_read: "Selecione um capítulo para iniciar a leitura.",
    tag_love: "Amor",
    tag_forgiveness: "Perdão",
    tag_hope: "Esperança",
    tag_justice: "Justiça",
    tag_peace: "Paz",
    tag_wisdom: "Sabedoria",
    tag_creation: "Criação",
    tag_redemption: "Redenção",
    confirm_download_book: "Deseja descarregar todos os {0} capítulos de {1} para uso offline? Isto pode levar alguns minutos.",
    download_book_success: "{0} descarregado com sucesso! {1} capítulos guardados.",
    download_book_error: "Ocorreu um erro ao descarregar alguns capítulos.",
    confirm_download_version: "Deseja descarregar a tradução completa \"{0}\" para uso offline? Isto pode levar alguns minutos.",
    download_progress: "Progresso: {0}%",
    download_complete_count: "Descarregamento de {0} concluído! {1} capítulos guardados.",
    lexicon_error: "Erro ao procurar informações lexicais.",
    lexicon_loading: "A procurar informações léxicas...",
    lexicon_study: "Estudo Lexicográfico",
    lexicon_meaning: "Significado Exegético",
    lexicon_grammar: "Análise Gramatical",
    lexicon_context: "Contexto Histórico",
    lexicon_connections: "Ligações Linguísticas",
    lexicon_applications: "Aplicações e Usos",
    lexicon_footer: "Léxico Académico Profundo",
    verse_of_the_moment: "Versículo do Momento",
    lexicon_pronunciation: "Pronúncia",
    lexicon_primary_root: "Raiz Primária",
    lexicon_lxx_greek: "Septuaginta (LXX) / Grego",
    lexicon_biblical_aramaic: "Aramaico Bíblico",
    reading_reminder: "Lembrete de Leitura",
    reading_reminder_body: "É hora da sua meditação diária nas Escrituras.",
    chapter_content_fallback_1: "Conteúdo do capítulo {0} de {1} (Simulação).",
    chapter_content_fallback_2: "Para visualizar o texto real, certifique-se de que a chave API está configurada.",
    version_label: "Versão",
    font_manuscript: "Manuscrito",
    font_bold: "Negrito",
    notifications_enabled: "Notificações Ativadas",
    notifications_enabled_body: "Receberá versículos diários e atualizações.",
    notification_permission_denied: "Permissão de notificação negada.",
    notifications_not_supported: "Este navegador não suporta notificações.",
    app_installed_success: "Aplicação instalada com sucesso!",
    addition_esther_greek: "Adições Gregas",
    addition_azarias: "Oração de Azarias",
    addition_susana: "Susana",
    addition_bel_dragon: "Bel e o Dragão",
    with_additions: "com adições",
    greek_additions: "adições gregas",
    tts_not_supported: "Leitura em voz alta não suportada neste navegador.",
    canon_history_title: "História do Cânone",
    feedback_title: "A sua opinião importa",
    feedback_subtitle: "Como podemos melhorar a sua experiência de estudo?",
    translation_kjv_desc: "Tradução clássica e autorizada.",
    translation_jfa_desc: "A versão mais tradicional em português.",
    translation_niv_desc: "Linguagem moderna e clara.",
    translation_nvi_desc: "Equilíbrio entre fidelidade e clareza.",
    translation_rv_desc: "A versão clássica em espanhol.",
    translation_lsg_desc: "A versão de referência em francês.",
    translation_vkj_pt_desc: "Tradução fiel aos textos originais.",
    translation_vkj_fr_desc: "Tradução fiel aos textos originais.",
    translation_vkj_es_desc: "Tradução fiel aos textos originais.",
    translation_hebrew_desc: "O Antigo Testamento na sua língua original.",
    translation_aramaic_desc: "Textos em aramaico antigo.",
    translation_greek_desc: "O Novo Testamento em Grego Koiné.",
    lang_english: "Inglês",
    lang_portuguese: "Português",
    lang_portuguese_br: "Português (Brasil)",
    lang_portuguese_pt: "Português (Portugal)",
    lang_spanish: "Espanhol",
    lang_french: "Francês",
    lang_hebrew: "Hebraico",
    lang_aramaic: "Aramaico",
    lang_greek: "Grego",
    color_gold: "Dourado",
    color_emerald: "Esmeralda",
    color_ruby: "Rubi",
    color_earth: "Terra",
    color_black: "Preto",
    color_white: "Branco",
    bibliology_btn: "Bibliologia",
    bibliology_title: "Bibliologia: {0}",
    bibliology_loading: "Sondando a história do livro...",
    bibliology_error: "Não foi possível carregar a bibliologia.",
    show_apocrypha: "Apócrifos",
    hide_apocrypha: "Esconder Apócrifos",
    book_names: {
      1: "Génesis", 2: "Êxodo", 3: "Levítico", 4: "Números", 5: "Deuteronómio",
      6: "Josué", 7: "Juízes", 8: "Rute", 9: "1 Samuel", 10: "2 Samuel",
      11: "1 Reis", 12: "2 Reis", 13: "1 Crónicas", 14: "2 Crónicas",
      15: "Esdras", 16: "Neemias", 17: "Ester", 18: "Job", 19: "Salmos",
      20: "Provérbios", 21: "Eclesiastes", 22: "Cânticos", 23: "Isaías",
      24: "Jeremias", 25: "Lamentações", 26: "Ezequiel", 27: "Daniel",
      28: "Oseias", 29: "Joel", 30: "Amós", 31: "Obadias", 32: "Jonas",
      33: "Miqueias", 34: "Naum", 35: "Habacuque", 36: "Sofonias",
      37: "Ageu", 38: "Zacarias", 39: "Malaquias",
      40: "Mateus", 41: "Marcos", 42: "Lucas", 43: "João", 44: "Atos",
      45: "Romanos", 46: "1 Coríntios", 47: "2 Coríntios", 48: "Gálatas",
      49: "Efésios", 50: "Filipenses", 51: "Colossenses", 52: "1 Tessalonicenses",
      53: "2 Tessalonicenses", 54: "1 Timóteo", 55: "2 Timóteo", 56: "Tito",
      57: "Filemón", 58: "Hebreus", 59: "Tiago", 60: "1 Pedro", 61: "2 Pedro",
      62: "1 João", 63: "2 João", 64: "3 João", 65: "Judas", 66: "Apocalipse",
      101: "Tobias", 102: "Judite", 103: "Sabedoria", 104: "Eclesiástico",
      105: "Baruque", 106: "1 Macabeus", 107: "2 Macabeus", 108: "1 Esdras",
      109: "3 Macabeus", 110: "4 Macabeus", 111: "Oração de Manassés", 112: "Salmo 151",
      201: "Didaquê", 202: "1 Clemente", 203: "Epístola de Barnabé", 204: "Pastor de Hermas",
      205: "Apocalipse de Pedro", 206: "Evangelho de Tomé", 207: "Atos de Paulo e Tecla",
      208: "Epístola de Policarpo", 209: "Epístola aos Laodicenses", 210: "Evangelho de Filipe",
      211: "Evangelho de Maria Madalena", 212: "Atos de Pedro", 213: "Atos de João",
      214: "Apocalipse de Paulo", 215: "Oração de Azarias", 216: "Susana",
      217: "Bel e o Dragão", 218: "Evangelho de Judas", 219: "Apocalipse de Tiago",
      220: "Atos de Tomé", 221: "Evangelho de Nicodemos", 222: "Oração de Paulo"
    }
  },
  en: {
    library: "Library",
    read: "Read",
    search: "Search",
    settings: "Settings",
    translations: "Translations",
    original_languages: "Original Languages",
    notes: "Notes",
    favorites: "Favorites",
    history_btn: "Canon History",
    apocrypha_history: "Canonization History",
    all: "All",
    search_placeholder: "What are you looking for today?",
    download_all: "Download All",
    clear_cache: "Clear All",
    language: "App Language",
    system: "System",
    font_size: "Typography Size",
    font_family: "Font Type",
    theme: "Theme & Color",
    offline_manager: "Offline Manager",
    download_book: "Download Book",
    download_version: "Download Version",
    search_versions: "Search more versions",
    no_notes: "No notes yet.",
    no_favorites: "No favorites yet.",
    save: "Save",
    delete: "Delete",
    edit: "Edit",
    app_title: "LEX BIBLE",
    tagline: "Holy Scriptures",
    ot_title: "Old Testament",
    ot_subtitle: "The Law, the Prophets, and the Writings",
    nt_title: "New Testament",
    nt_subtitle: "The Gospels and Apostolic Epistles",
    apocrypha_title: "Early Period Historical Books",
    apocrypha_subtitle: "Writings from the Apostolic and Post-Apostolic Era",
    deuterocanon_title: "Deuterocanonical Books",
    chapters_label: "Chapters",
    chapter_label: "Chapter",
    versicles_label: "Verses",
    versicle_label: "Verse",
    downloading_version: "Downloading {0}...",
    download_complete: "Download of {0} complete!",
    feedback_thanks: "Thank you for your feedback!",
    link_copied: "Link copied to clipboard!",
    favorite_added: "Verse added to favorites!",
    favorite_removed: "Favorite removed!",
    share_text: "Check out this amazing app for Bible study!",
    current_version: "Current version: {0}",
    bible_canon: "Bible Canon",
    book_names: {
      1: "Genesis", 2: "Exodus", 3: "Leviticus", 4: "Numbers", 5: "Deuteronomy",
      6: "Joshua", 7: "Judges", 8: "Ruth", 9: "1 Samuel", 10: "2 Samuel",
      11: "1 Kings", 12: "2 Kings", 13: "1 Chronicles", 14: "2 Chronicles",
      15: "Ezra", 16: "Nehemiah", 17: "Esther", 18: "Job", 19: "Psalms",
      20: "Proverbs", 21: "Ecclesiastes", 22: "Song of Solomon", 23: "Isaiah",
      24: "Jeremiah", 25: "Lamentations", 26: "Ezekiel", 27: "Daniel",
      28: "Hosea", 29: "Joel", 30: "Amos", 31: "Obadiah", 32: "Jonas",
      33: "Micah", 34: "Nahum", 35: "Habakkuk", 36: "Zephaniah",
      37: "Haggai", 38: "Zechariah", 39: "Malachi",
      40: "Matthew", 41: "Mark", 42: "Luke", 43: "John", 44: "Acts",
      45: "Romans", 46: "1 Corinthians", 47: "2 Corinthians", 48: "Galatians",
      49: "Ephesians", 50: "Philippians", 51: "Colossians", 52: "1 Thessalonians",
      53: "2 Thessalonians", 54: "1 Timothey", 55: "2 Timothey", 56: "Titus",
      57: "Philemon", 58: "Hebrews", 59: "James", 60: "1 Peter", 61: "2 Peter",
      62: "1 John", 63: "2 John", 64: "3 John", 65: "Jude", 66: "Revelation",
      101: "Tobit", 102: "Judith", 103: "Wisdom", 104: "Sirach",
      105: "Baruch", 106: "1 Maccabees", 107: "2 Maccabees", 108: "1 Esdras",
      109: "3 Maccabees", 110: "4 Maccabees", 111: "Prayer of Manasseh", 112: "Psalm 151",
      201: "Didache", 202: "1 Clement", 203: "Epistle of Barnabas", 204: "Shepherd of Hermas",
      205: "Apocalypse of Peter", 206: "Gospel of Thomas", 207: "Acts of Paul and Thecla",
      208: "Epistle of Polycarp", 209: "Epistle to the Laodiceans", 210: "Gospel of Philip",
      211: "Gospel of Mary Magdalene", 212: "Acts of Peter", 213: "Acts of John",
      214: "Apocalypse of Paul", 215: "Prayer of Azariah", 216: "Susanna",
      217: "Bel and the Dragon", 218: "Gospel of Judas", 219: "Apocalypse of James",
      220: "Acts of Thomas", 221: "Gospel of Nicodemus", 222: "Prayer of Paul"
    },
    protestant: "Protestant",
    catholic: "Catholic",
    orthodox: "Orthodox",
    fluent_verse: "Fluent Verse",
    daily_verse: "Daily Verse",
    loading_meditation: "Loading daily meditation...",
    deuterocanon_label: "Deuterocanonical",
    select_book: "Select a Book",
    select_chapter: "Select a Chapter",
    downloading: "Downloading...",
    download_full_book: "Download Full Book",
    offline: "Offline",
    online: "Online",
    refresh_cache: "Reload and Update Cache",
    stop_reading: "Stop Reading",
    start_reading: "Read Aloud",
    fetching_scriptures: "Fetching scriptures...",
    scripture_exploration: "Scripture Exploration",
    deep_search: "Deep Search",
    deep_search_desc: "Probe the depths of God's Word by themes, keywords, or specific references.",
    search_placeholder_deep: "What are you looking for today? (e.g., Love, Faith, Salvation)",
    search_btn: "Search",
    suggested_themes: "Suggested Themes",
    study_tip: "Study Tip",
    study_tip_desc: "Use specific keywords or theological themes to find connections between the Old and New Testaments.",
    searching_scriptures: "Searching the scriptures...",
    seeking_wisdom: "Seeking eternal wisdom",
    click_to_read: "Click to read the full chapter",
    no_results: "No results found for your search.",
    clear_search: "Clear search",
    customization: "Customization",
    customization_desc: "Personalize your reading experience for the holiness of the word.",
    reset: "Reset",
    text_preview: "Text Preview",
    preview_verse: "In the beginning was the Word, and the Word was with God, and the Word was God.",
    preview_ref: "John 1:1",
    bible_mode: "Bible Mode",
    bible_mode_desc: "Select the biblical canon to organize the books in your library.",
    protestant: "Protestant",
    catholic: "Catholic",
    orthodox: "Orthodox",
    interface_appearance: "Interface Appearance",
    theme_mode: "Theme Mode",
    light: "Light",
    dark: "Dark",
    system: "System",
    accent_color: "Accent Color",
    accent_text_color: "Accent Text Color",
    tts_settings: "Text-to-Speech (TTS)",
    voice_speed: "Voice Speed",
    voice_pitch: "Voice Pitch",
    voice: "Voice",
    device_voice: "Device Voice",
    default_voice: "Default Voice",
    stored_content: "Stored Content",
    stored_content_desc: "Saved chapters and original meanings.",
    cache_cleared: "Cache cleared!",
    current_book: "Current Book",
    download_book_desc: "Download all chapters of {book}.",
    select_book: "select a book",
    downloading: "Downloading...",
    download_book: "Download Book",
    full_translation: "Full Translation",
    download_translation_desc: "Download the entire {version} version (66 books).",
    download_all: "Download All",
    downloaded_chapters: "Downloaded Chapters ({count})",
    no_chapters_saved: "No chapters saved yet.",
    lamp_verse: "Your word is a lamp to my feet and a light to my path.",
    lamp_ref: "Psalms 119:105",
    select_version_desc: "Select your preferred version of the Scriptures.",
    download_full_translation: "Download Full Translation",
    original_languages: "Original Languages",
    original_languages_desc: "Access the sacred texts in Hebrew, Aramaic, and Greek.",
    menu: "Menu",
    notifications: "Notifications",
    notes: "Notes",
    favorites: "Favorite Verses",
    share_app: "Share App",
    about_dev: "About Developer",
    send_feedback: "Send Feedback",
    notes_title: "Notes",
    new_note: "New Note",
    no_reference: "No reference",
    note_title_placeholder: "Note title...",
    note_content_placeholder: "Start writing your reflection...",
    confirm_delete_note: "Do you want to delete this note?",
    note_deleted: "Note deleted!",
    delete: "Delete",
    note_saved_auto: "Note saved automatically!",
    save: "Save",
    select_or_create_note: "Select or create a note to start.",
    favorites_title: "Favorites",
    category: "Category",
    confirm_remove_favorite: "Remove from favorites?",
    removed: "Removed!",
    no_favorites: "You haven't favorited any verses yet.",
    dev_name: "Augusto Gonçalves",
    dev_title: "(Developer and Preacher of the Gospel of Jesus Christ)",
    dev_bio: "Dedicated to the promotion of knowledge and deepening the understanding of the Scriptures and Christian spirituality, I seek to create tools that make the Word accessible to everyone, everywhere.",
    dev_email: "augustogoncalvesapostly@gmail.com",
    dev_whatsapp: "+244 972 664 768",
    dev_facebook: "Augusto Gonçalves",
    dev_whatsapp_url: "https://wa.me/244972664768",
    dev_facebook_url: "https://www.facebook.com/shala.augusto.goncalves",
    notifications_subtitle: "Stay connected with the Word throughout the day.",
    enable_notifications: "Enable Notifications",
    enable_notifications_desc: "Receive alerts and verses on your device.",
    fluent_widget: "Fluent Verse Widget",
    fluent_widget_desc: "Displays periodic verses on your main screen.",
    daily_reminder: "Daily Reading Reminder",
    daily_reminder_desc: "Receive a reminder to read the Bible every day.",
    reminder_time: "Reminder Time",
    notifications_active_msg: "Notifications are active. You will receive a portion of the Word every hour.",
    notification_test: "Notification Test",
    test_notification_now: "Test Notification Now",
    back_to_library: "Back to Library",
    consulting_lexicons: "Consulting original lexicons...",
    books: "Books",
    reading: "Reading",
    search: "Search",
    settings: "Settings",
    feedback_placeholder: "Write your message here...",
    send_message: "Send Message",
    confirm_action: "Confirm Action",
    cancel: "Cancel",
    confirm: "Confirm",
    versions_found: "New versions found!",
    versions_error: "Error searching versions.",
    exit_fullscreen: "Exit Fullscreen",
    enter_fullscreen: "Fullscreen",
    default: "Default",
    copy: "Copy",
    note: "Note",
    note_in: "Note in",
    clear: "Clear",
    select_chapter_to_read: "Select a chapter to start reading.",
    tag_love: "Love",
    tag_forgiveness: "Forgiveness",
    tag_hope: "Hope",
    tag_justice: "Justice",
    tag_peace: "Peace",
    tag_wisdom: "Wisdom",
    tag_creation: "Creation",
    tag_redemption: "Redemption",
    confirm_download_book: "Do you want to download all {0} chapters of {1} for offline use? This may take a few minutes.",
    download_book_success: "{0} downloaded successfully! {1} chapters saved.",
    download_book_error: "An error occurred while downloading some chapters.",
    confirm_download_version: "Do you want to download the complete translation \"{0}\" for offline use? This may take a few minutes.",
    download_progress: "Progress: {0}%",
    download_complete_count: "Download of {0} complete! {1} chapters saved.",
    lexicon_error: "Error fetching lexical information.",
    lexicon_loading: "Fetching lexical info...",
    lexicon_study: "Lexicographical Study",
    lexicon_meaning: "Exegetical Meaning",
    lexicon_grammar: "Grammatical Analysis",
    lexicon_context: "Historical Context",
    lexicon_connections: "Linguistic Connections",
    lexicon_applications: "Applications and Uses",
    lexicon_footer: "Deep Academic Lexicon",
    verse_of_the_moment: "Verse of the Moment",
    lexicon_pronunciation: "Pronunciation",
    lexicon_primary_root: "Primary Root",
    lexicon_lxx_greek: "Septuagint (LXX) / Greek",
    lexicon_biblical_aramaic: "Biblical Aramaic",
    reading_reminder: "Reading Reminder",
    reading_reminder_body: "It's time for your daily meditation on the Scriptures.",
    chapter_content_fallback_1: "Content of chapter {0} of {1} (Simulation).",
    chapter_content_fallback_2: "To view the actual text, make sure the API key is configured.",
    version_label: "Version",
    font_manuscript: "Manuscript",
    font_bold: "Bold",
    notifications_enabled: "Notifications Enabled",
    notifications_enabled_body: "You will receive daily verses and updates.",
    notification_permission_denied: "Notification permission denied.",
    notifications_not_supported: "This browser does not support notifications.",
    app_installed_success: "App installed successfully!",
    addition_esther_greek: "Greek Additions",
    addition_azarias: "Prayer of Azariah",
    addition_susana: "Susanna",
    addition_bel_dragon: "Bel and the Dragon",
    with_additions: "with additions",
    greek_additions: "greek additions",
    tts_not_supported: "Text-to-speech not supported in this browser.",
    canon_history_title: "Canon History",
    feedback_title: "Your opinion matters",
    feedback_subtitle: "How can we improve your study experience?",
    translation_kjv_desc: "Classic and authorized translation.",
    translation_jfa_desc: "The most traditional version in Portuguese.",
    translation_niv_desc: "Modern and clear language.",
    translation_nvi_desc: "Balance between faithfulness and clarity.",
    translation_rv_desc: "The classic version in Spanish.",
    translation_lsg_desc: "The reference version in French.",
    translation_vkj_pt_desc: "Faithful translation to original texts.",
    translation_vkj_fr_desc: "Faithful translation to original texts.",
    translation_vkj_es_desc: "Faithful translation to original texts.",
    translation_hebrew_desc: "The Old Testament in its original language.",
    translation_aramaic_desc: "Texts in ancient Aramaic.",
    translation_greek_desc: "The New Testament in Koine Greek.",
    lang_english: "English",
    lang_portuguese: "Portuguese",
    lang_spanish: "Spanish",
    lang_french: "French",
    lang_hebrew: "Hebrew",
    lang_aramaic: "Aramaic",
    lang_greek: "Greek",
    color_gold: "Gold",
    color_emerald: "Emerald",
    color_ruby: "Ruby",
    color_earth: "Earth",
    color_black: "Black",
    color_white: "White",
    bibliology_btn: "Bibliology",
    bibliology_title: "Bibliology: {0}",
    bibliology_loading: "Probing the book's history...",
    bibliology_error: "Could not load bibliology.",
    show_apocrypha: "Apocrypha",
    hide_apocrypha: "Hide Apocrypha",
    book_names: {
      1: "Genesis", 2: "Exodus", 3: "Leviticus", 4: "Numbers", 5: "Deuteronomy",
      6: "Joshua", 7: "Judges", 8: "Ruth", 9: "1 Samuel", 10: "2 Samuel",
      11: "1 Kings", 12: "2 Kings", 13: "1 Chronicles", 14: "2 Chronicles",
      15: "Ezra", 16: "Nehemiah", 17: "Esther", 18: "Job", 19: "Psalms",
      20: "Proverbs", 21: "Ecclesiastes", 22: "Song of Solomon", 23: "Isaiah",
      24: "Jeremiah", 25: "Lamentations", 26: "Ezekiel", 27: "Daniel",
      28: "Hosea", 29: "Joel", 30: "Amos", 31: "Obadiah", 32: "Jonah",
      33: "Micah", 34: "Nahum", 35: "Habakkuk", 36: "Zephaniah",
      37: "Haggai", 38: "Zechariah", 39: "Malachi",
      40: "Matthew", 41: "Mark", 42: "Luke", 43: "John", 44: "Acts",
      45: "Romans", 46: "1 Corinthians", 47: "2 Corinthians", 48: "Galatians",
      49: "Ephesians", 50: "Philippians", 51: "Colossians", 52: "1 Thessalonians",
      53: "2 Thessalonians", 54: "1 Timothy", 55: "2 Timothy", 56: "Titus",
      57: "Philemon", 58: "Hebrews", 59: "James", 60: "1 Peter", 61: "2 Peter",
      62: "1 John", 63: "2 John", 64: "3 John", 65: "Jude", 66: "Revelation",
      101: "Tobit", 102: "Judith", 103: "Wisdom", 104: "Sirach",
      105: "Baruch", 106: "1 Maccabees", 107: "2 Maccabees", 108: "1 Esdras",
      109: "3 Maccabees", 110: "4 Maccabees", 111: "Prayer of Manasseh", 112: "Psalm 151",
      201: "Didache", 202: "1 Clement", 203: "Epistle of Barnabas", 204: "Shepherd of Hermas",
      205: "Apocalypse of Peter", 206: "Gospel of Thomas", 207: "Acts of Paul and Thecla",
      208: "Epistle of Polycarp", 209: "Epistle to the Laodiceans", 210: "Gospel of Philip",
      211: "Gospel of Mary Magdalene", 212: "Acts of Peter", 213: "Acts of John",
      214: "Apocalypse of Paul", 215: "Prayer of Azariah", 216: "Susanna",
      217: "Bel and the Dragon", 218: "Gospel of Judas", 219: "Apocalypse of James",
      220: "Acts of Thomas", 221: "Gospel of Nicodemus", 222: "Prayer of Paul"
    }
  },
  es: {
    library: "Biblioteca",
    read: "Lectura",
    search: "Buscar",
    settings: "Ajustes",
    translations: "Traducciones",
    original_languages: "Lenguas Originales",
    notes: "Notas",
    favorites: "Favoritos",
    history_btn: "Historia del Canon",
    apocrypha_history: "Historia de Canonización",
    all: "Todos",
    search_placeholder: "¿Qué buscas hoy?",
    download_all: "Descargar Todo",
    clear_cache: "Limpiar Todo",
    language: "Idioma de la Aplicación",
    system: "Sistema",
    font_size: "Tamaño de Tipografía",
    font_family: "Tipo de Letra",
    theme: "Tema y Color",
    offline_manager: "Gestionar Offline",
    download_book: "Descargar Libro",
    download_version: "Descargar Versión",
    search_versions: "Buscar más versiones",
    no_notes: "No hay notas aún.",
    no_favorites: "No hay favoritos aún.",
    save: "Guardar",
    delete: "Eliminar",
    edit: "Editar",
    app_title: "LEX BIBLE",
    tagline: "Sagradas Escrituras",
    ot_title: "Antiguo Testamento",
    ot_subtitle: "La Ley, los Profetas y os Escritos",
    nt_title: "Nuevo Testamento",
    nt_subtitle: "Los Evangelios y las Epístolas Apostólicas",
    apocrypha_title: "Libros Históricos del Periodo Primitivo",
    apocrypha_subtitle: "Escritos de la Era Apostólica y Post-Apostólica",
    deuterocanon_title: "Libros Deuterocanónicos",
    chapters_label: "Capítulos",
    chapter_label: "Capítulo",
    versicles_label: "Versículos",
    versicle_label: "Versículo",
    downloading_version: "Descargando {0}...",
    download_complete: "¡Descarga de {0} completada!",
    feedback_thanks: "¡Gracias por tu comentario!",
    link_copied: "¡Enlace copiado al portapapeles!",
    favorite_added: "¡Versículo marcado como favorito!",
    favorite_removed: "¡Favorito eliminado!",
    share_text: "¡Mira esta increíble aplicación para el estudio de la Biblia!",
    current_version: "Versión actual: {0}",
    bible_canon: "Canon Bíblico",
    protestant: "Protestante",
    catholic: "Católico",
    orthodox: "Ortodoxo",
    fluent_verse: "Versículo Fluente",
    daily_verse: "Versículo del Día",
    loading_meditation: "Cargando meditación diaria...",
    deuterocanon_label: "Deuterocanónico",
    select_book: "Seleccione un Libro",
    select_chapter: "Seleccione el Capítulo",
    downloading: "Descargando...",
    download_full_book: "Descargar Libro Completo",
    offline: "Fuera de línea",
    online: "En línea",
    refresh_cache: "Recargar y Actualizar Caché",
    stop_reading: "Detener Lectura",
    start_reading: "Leer en Voz Alta",
    fetching_scriptures: "Buscando escrituras...",
    scripture_exploration: "Exploración de las Escrituras",
    deep_search: "Búsqueda Profunda",
    deep_search_desc: "Sondee las profundidades de la Palabra de Dios por temas, palabras clave o referencias específicas.",
    search_placeholder_deep: "¿Qué buscas hoy? (ej: Amor, Fe, Salvación)",
    search_btn: "Buscar",
    suggested_themes: "Temas Sugeridos",
    study_tip: "Consejo de Estudio",
    study_tip_desc: "Use palabras clave específicas o temas teológicos para encontrar conexiones entre el Antiguo y el Nuevo Testamento.",
    searching_scriptures: "Sondeando las escrituras...",
    seeking_wisdom: "Buscando sabiduría eterna",
    click_to_read: "Haga clic para leer el capítulo completo",
    no_results: "No se encontraron resultados para su búsqueda.",
    clear_search: "Limpiar búsqueda",
    customization: "Personalización",
    customization_desc: "Personalice su experiencia de lectura para la santidad de la palabra.",
    reset: "Restablecer",
    text_preview: "Vista previa del texto",
    preview_verse: "En el principio era el Verbo, y el Verbo estaba con Dios, y el Verbo era Dios.",
    preview_ref: "Juan 1:1",
    bible_mode: "Modo de la Biblia",
    bible_mode_desc: "Seleccione el canon bíblico para organizar los libros de su biblioteca.",
    protestant: "Protestante",
    catholic: "Católica",
    orthodox: "Ortodoxa",
    interface_appearance: "Apariencia de la interfaz",
    theme_mode: "Modo de tema",
    light: "Claro",
    dark: "Oscuro",
    system: "Sistema",
    accent_color: "Color de acento",
    accent_text_color: "Color del texto de acento",
    tts_settings: "Lectura en voz alta (TTS)",
    voice_speed: "Velocidad de la voz",
    voice_pitch: "Tono de la voz",
    voice: "Voz",
    device_voice: "Voz del dispositivo",
    default_voice: "Voz predeterminada",
    stored_content: "Contenido almacenado",
    stored_content_desc: "Capítulos y significados originales guardados.",
    cache_cleared: "¡Caché borrado!",
    current_book: "Libro actual",
    download_book_desc: "Descarga todos los capítulos de {book}.",
    select_book: "seleccione un libro",
    downloading: "Descargando...",
    download_book: "Descargar libro",
    full_translation: "Traducción completa",
    download_translation_desc: "Descarga toda la versión {version} (66 libros).",
    download_all: "Descargar todo",
    downloaded_chapters: "Capítulos descargados ({count})",
    no_chapters_saved: "Aún no hay capítulos guardados.",
    lamp_verse: "Lámpara es a mis pies tu palabra, y lumbrera a mi camino.",
    lamp_ref: "Salmos 119:105",
    select_version_desc: "Seleccione su versión preferida de las Escrituras.",
    download_full_translation: "Descargar traducción completa",
    original_languages: "Idiomas originales",
    original_languages_desc: "Acceda a los textos sagrados en hebreo, arameo y griego.",
    menu: "Menú",
    notifications: "Notificaciones",
    notes: "Notas",
    favorites: "Versículos favoritos",
    share_app: "Compartir aplicación",
    about_dev: "Sobre el desarrollador",
    send_feedback: "Enviar comentarios",
    notes_title: "Notas",
    new_note: "Nueva nota",
    no_reference: "Sin referencia",
    note_title_placeholder: "Título de la nota...",
    note_content_placeholder: "Empieza a escribir tu reflexión...",
    confirm_delete_note: "¿Quieres eliminar esta nota?",
    note_deleted: "¡Nota eliminada!",
    delete: "Eliminar",
    note_saved_auto: "¡Nota guardada automáticamente!",
    save: "Guardar",
    select_or_create_note: "Seleccione o cree una nota para comenzar.",
    favorites_title: "Favoritos",
    category: "Categoría",
    confirm_remove_favorite: "¿Quitar de favoritos?",
    removed: "¡Eliminado!",
    no_favorites: "Aún no has marcado ningún versículo como favorito.",
    dev_name: "Augusto Gonçalves",
    dev_title: "(Desarrollador y Predicador del Evangelio de Cristo Jesús)",
    dev_bio: "Dedicado a la promoción del conocimiento y a profundizar la comprensión de las Escrituras y la espiritualidad cristiana, busco crear herramientas que hagan la Palabra accesible para todos, en cualquier lugar.",
    dev_email: "augustogoncalvesapostly@gmail.com",
    dev_whatsapp: "+244 972 664 768",
    dev_facebook: "Shalah Augusto Gonçalves",
    dev_whatsapp_url: "https://wa.me/244972664768",
    dev_facebook_url: "https://www.facebook.com/shalah.augusto.goncalves",
    notifications_subtitle: "Manténgase conectado con la Palabra durante todo el día.",
    enable_notifications: "Activar notificaciones",
    enable_notifications_desc: "Reciba alertas y versículos en su dispositivo.",
    fluent_widget: "Widget de versículos fluidos",
    fluent_widget_desc: "Muestra versículos periódicos en su pantalla principal.",
    daily_reminder: "Recordatorio de lectura diaria",
    daily_reminder_desc: "Reciba un recordatorio para leer la Biblia todos los días.",
    reminder_time: "Hora del recordatorio",
    notifications_active_msg: "Las notificaciones están activas. Recibirás una porción de la Palabra cada hora.",
    notification_test: "Prueba de notificación",
    test_notification_now: "Probar notificación ahora",
    back_to_library: "Volver a la biblioteca",
    consulting_lexicons: "Consultando léxicos originales...",
    books: "Libros",
    reading: "Lectura",
    search: "Buscar",
    settings: "Configuración",
    feedback_placeholder: "Escribe tu mensaje aquí...",
    send_message: "Enviar mensaje",
    confirm_action: "Confirmar acción",
    cancel: "Cancelar",
    confirm: "Confirmar",
    versions_found: "¡Nuevas versiones encontradas!",
    versions_error: "Error al buscar versiones.",
    exit_fullscreen: "Salir de pantalla completa",
    enter_fullscreen: "Pantalla completa",
    default: "Predeterminado",
    copy: "Copiar",
    note: "Nota",
    note_in: "Nota en",
    clear: "Limpiar",
    select_chapter_to_read: "Seleccione un capítulo para comenzar a leer.",
    tag_love: "Amor",
    tag_forgiveness: "Perdón",
    tag_hope: "Esperanza",
    tag_justice: "Justicia",
    tag_peace: "Paz",
    tag_wisdom: "Sabiduría",
    tag_creation: "Creación",
    tag_redemption: "Redención",
    confirm_download_book: "¿Desea descargar los {0} capítulos de {1} para uso sin conexión? Esto puede tardar unos minutos.",
    download_book_success: "¡{0} descargado con éxito! {1} capítulos guardados.",
    download_book_error: "Ocurrió un error al descargar algunos capítulos.",
    confirm_download_version: "¿Desea descargar la traducción completa \"{0}\" para uso sin conexión? Esto puede tardar unos minutos.",
    download_progress: "Progreso: {0}%",
    download_complete_count: "¡Descarga de {0} completada! {1} capítulos guardados.",
    lexicon_error: "Error al buscar información léxica.",
    lexicon_loading: "Buscando información léxica...",
    lexicon_study: "Estudio Lexicográfico",
    lexicon_meaning: "Significado Exegético",
    lexicon_grammar: "Análisis Gramatical",
    lexicon_context: "Contexto Histórico",
    lexicon_connections: "Conexiones Lingüísticas",
    lexicon_applications: "Aplicaciones y Usos",
    lexicon_footer: "Léxico Académico Profundo",
    verse_of_the_moment: "Versículo del Momento",
    lexicon_pronunciation: "Pronunciación",
    lexicon_primary_root: "Raíz Primaria",
    lexicon_lxx_greek: "Septuaginta (LXX) / Griego",
    lexicon_biblical_aramaic: "Arameo Bíblico",
    reading_reminder: "Recordatorio de lectura",
    reading_reminder_body: "Es hora de tu meditación diaria en las Escrituras.",
    chapter_content_fallback_1: "Contenido del capítulo {0} de {1} (Simulación).",
    chapter_content_fallback_2: "Para ver el texto real, asegúrese de que la clave API esté configurada.",
    version_label: "Versión",
    font_manuscript: "Manuscrito",
    font_bold: "Negrita",
    notifications_enabled: "Notificaciones activadas",
    notifications_enabled_body: "Recibirás versículos diarios y actualizaciones.",
    notification_permission_denied: "Permiso de notificación denegado.",
    notifications_not_supported: "Este navegador no soporta notificaciones.",
    app_installed_success: "¡Aplicación instalada con éxito!",
    addition_esther_greek: "Adiciones Griegas",
    addition_azarias: "Oración de Azarías",
    addition_susana: "Susana",
    addition_bel_dragon: "Bel y el Dragón",
    with_additions: "con adiciones",
    greek_additions: "adiciones griegas",
    tts_not_supported: "La lectura en voz alta no es compatible con este navegador.",
    canon_history_title: "Historia del Canon",
    feedback_title: "Tu opinión importa",
    feedback_subtitle: "¿Cómo podemos mejorar tu experiencia de estudio?",
    translation_kjv_desc: "Traducción clásica y autorizada.",
    translation_jfa_desc: "La versión más tradicional en portugués.",
    translation_niv_desc: "Lenguaje moderno y claro.",
    translation_nvi_desc: "Equilibrio entre fidelidad y claridad.",
    translation_rv_desc: "La versión clásica en español.",
    translation_lsg_desc: "La versión de referencia en francés.",
    translation_vkj_pt_desc: "Traducción fiel a los textos originales.",
    translation_vkj_fr_desc: "Traducción fiel a los textos originales.",
    translation_vkj_es_desc: "Traducción fiel a los textos originales.",
    translation_hebrew_desc: "El Antiguo Testamento en su lengua original.",
    translation_aramaic_desc: "Textos en arameo antiguo.",
    translation_greek_desc: "El Nuevo Testamento en griego koiné.",
    lang_english: "Inglés",
    lang_portuguese: "Portugués",
    lang_spanish: "Español",
    lang_french: "Francés",
    lang_hebrew: "Hebreo",
    lang_aramaic: "Arameo",
    lang_greek: "Griego",
    color_gold: "Dorado",
    color_emerald: "Esmeralda",
    color_ruby: "Rubí",
    color_earth: "Tierra",
    color_black: "Negro",
    color_white: "Blanco",
    bibliology_btn: "Bibliología",
    bibliology_title: "Bibliología: {0}",
    bibliology_loading: "Sondeando la historia del libro...",
    bibliology_error: "No se pudo cargar la bibliología.",
    show_apocrypha: "Apócrifos",
    hide_apocrypha: "Ocultar Apócrifos",
    book_names: {
      1: "Génesis", 2: "Éxodo", 3: "Levítico", 4: "Números", 5: "Deuteronomio",
      6: "Josué", 7: "Jueces", 8: "Rut", 9: "1 Samuel", 10: "2 Samuel",
      11: "1 Reyes", 12: "2 Reyes", 13: "1 Crónicas", 14: "2 Crónicas",
      15: "Esdras", 16: "Nehemías", 17: "Ester", 18: "Job", 19: "Salmos",
      20: "Proverbios", 21: "Eclesiastés", 22: "Cantares", 23: "Isaías",
      24: "Jeremías", 25: "Lamentaciones", 26: "Ezequiel", 27: "Daniel",
      28: "Oseas", 29: "Joel", 30: "Amós", 31: "Abdías", 32: "Jonás",
      33: "Miqueas", 34: "Nahúm", 35: "Habacuc", 36: "Sofonías",
      37: "Hageo", 38: "Zacarías", 39: "Malaquías",
      40: "Mateo", 41: "Marcos", 42: "Lucas", 43: "Juan", 44: "Hechos",
      45: "Romanos", 46: "1 Corintios", 47: "2 Corintios", 48: "Gálatas",
      49: "Efesios", 50: "Filipenses", 51: "Colosenses", 52: "1 Tesalonicenses",
      53: "2 Tesalonicenses", 54: "1 Timoteo", 55: "2 Timoteo", 56: "Tito",
      57: "Filemón", 58: "Hebreos", 59: "Santiago", 60: "1 Pedro", 61: "2 Pedro",
      62: "1 Juan", 63: "2 Juan", 64: "3 Juan", 65: "Judas", 66: "Apocalipsis",
      101: "Tobías", 102: "Judit", 103: "Sabiduría", 104: "Eclesiástico",
      105: "Baruc", 106: "1 Macabeos", 107: "2 Macabeus", 108: "1 Esdras",
      109: "3 Macabeos", 110: "4 Macabeos", 111: "Oración de Manasés", 112: "Salmo 151",
      201: "Didaché", 202: "1 Clemente", 203: "Epístola de Bernabé", 204: "Pastor de Hermas",
      205: "Apocalipsis de Pedro", 206: "Evangelio de Tomás", 207: "Hechos de Pablo y Tecla",
      208: "Epístola de Policarpo", 209: "Epístola a los Laodicenses", 210: "Evangelio de Felipe",
      211: "Evangelio de María Magdalena", 212: "Hechos de Pedro", 213: "Hechos de Juan",
      214: "Apocalipsis de Pablo", 215: "Oración de Azarías", 216: "Susana",
      217: "Bel y el Dragón", 218: "Evangelio de Judas", 219: "Apocalipsis de Santiago",
      220: "Hechos de Tomás", 221: "Evangelio de Nicodemo", 222: "Oración de Pablo"
    }
  },
  fr: {
    library: "Bibliothèque",
    read: "Lecture",
    search: "Recherche",
    settings: "Paramètres",
    translations: "Traductions",
    original_languages: "Langues Originales",
    notes: "Notes",
    favorites: "Favoris",
    history_btn: "Histoire du Canon",
    apocrypha_history: "Histoire de la Canonisation",
    all: "Tous",
    search_placeholder: "Que cherchez-vous aujourd'hui ?",
    download_all: "Tout Télécharger",
    clear_cache: "Tout Effacer",
    language: "Langue de l'App",
    system: "Système",
    font_size: "Taille de Typographie",
    font_family: "Type de Police",
    theme: "Thème et Couleur",
    offline_manager: "Gérer Hors Ligne",
    download_book: "Télécharger Livre",
    download_version: "Télécharger Version",
    search_versions: "Rechercher plus de versions",
    no_notes: "Aucune note pour le moment.",
    no_favorites: "Aucun favori pour le moment.",
    no_results: "Aucun résultat trouvé pour votre recherche.",
    clear_search: "Effacer la recherche",
    customization: "Personnalisation",
    customization_desc: "Personnalisez votre expérience de lecture pour la sainteté de la parole.",
    reset: "Réinitialiser",
    text_preview: "Aperçu du Texte",
    preview_verse: "Au commencement était la Parole, et la Parole était avec Dieu, et la Parole était Dieu.",
    preview_ref: "Jean 1:1",
    bible_mode: "Mode de la Bible",
    bible_mode_desc: "Sélectionnez le canon biblique pour organiser les livres de votre bibliothèque.",
    protestant: "Protestant",
    catholic: "Catholique",
    orthodox: "Orthodoxe",
    interface_appearance: "Apparence de l'Interface",
    theme_mode: "Mode de Thème",
    light: "Clair",
    dark: "Sombre",
    accent_color: "Couleur d'Accentuation",
    accent_text_color: "Couleur du texte d'accentuation",
    accent_text_color: "Couleur du Texte d'Accentuation",
    tts_settings: "Lecture à Voix Haute (TTS)",
    voice_speed: "Vitesse de la Voix",
    voice_pitch: "Hauteur de la Voix",
    voice: "Voix",
    device_voice: "Voix du Dispositif",
    default_voice: "Voix par Défaut",
    stored_content: "Contenu Stocké",
    stored_content_desc: "Chapitres et significations originales sauvegardés.",
    cache_cleared: "Cache vidé !",
    current_book: "Livre Actuel",
    download_book_desc: "Téléchargez tous les chapitres de {book}.",
    select_book: "sélectionnez un livre",
    downloading: "Téléchargement...",
    full_translation: "Traduction Complète",
    download_full_book: "Télécharger le Livre Complet",
    select_chapter: "Sélectionner le Chapitre",
    offline: "Hors Ligne",
    online: "En Ligne",
    refresh_cache: "Recharger et Mettre à Jour le Cache",
    stop_reading: "Arrêter la Lecture",
    start_reading: "Lire à Voix Haute",
    fetching_scriptures: "Recherche des écritures...",
    scripture_exploration: "Exploration des Écritures",
    deep_search: "Recherche Profonde",
    deep_search_desc: "Sondez les profondeurs de la Parole de Dieu par thèmes, mots-clés ou références spécifiques.",
    search_placeholder_deep: "Que cherchez-vous aujourd'hui ? (ex: Amour, Foi, Salut)",
    search_btn: "Rechercher",
    suggested_themes: "Thèmes Suggérés",
    study_tip: "Conseil d'Étude",
    study_tip_desc: "Utilisez des mots-clés spécifiques ou des thèmes théologiques pour trouver des connexions entre l'Ancien et le Nouveau Testament.",
    searching_scriptures: "Sondage des écritures...",
    seeking_wisdom: "Recherche de la sagesse éternelle",
    click_to_read: "Cliquez pour lire le chapitre complet",
    ot_title: "Ancien Testament",
    nt_title: "Nouveau Testament",
    deuterocanon_title: "Deutérocanon",
    apocrypha_title: "Apocryphes",
    chapter_label: "Chapitre",
    chapters_label: "Chapitres",
    copy: "Copier",
    link_copied: "Lien copié !",
    favorite_added: "Ajouté aux favoris !",
    lexicon_biblical_hebrew: "Hébreu Biblique",
    lexicon_biblical_greek: "Grec Biblique",
    lexicon_biblical_aramaic: "Araméen Biblique",
    reading_reminder: "Rappel de Lecture",
    reading_reminder_body: "C'est l'heure de votre méditation quotidienne des Écritures.",
    chapter_content_fallback_1: "Contenu du chapitre {0} de {1} (Simulation).",
    chapter_content_fallback_2: "Pour voir le texte réel, assurez-vous que la clé API est configurée.",
    version_label: "Version",
    font_manuscript: "Manuscrit",
    font_bold: "Gras",
    notifications_enabled: "Notifications activées",
    notifications_enabled_body: "Vous recevrez des versets quotidiens et des mises à jour.",
    notification_permission_denied: "Permission de notification refusée.",
    feedback_thanks: "Merci pour votre avis !",
    save: "Enregistrer",
    delete: "Supprimer",
    edit: "Modifier",
    app_title: "LEX BIBLE",
    tagline: "Saintes Écritures",
    ot_title: "Ancien Testament",
    nt_title: "Nouveau Testament",
    apocrypha_title: "Livres Historiques de la Période Primitive",
    deuterocanon_title: "Livres Deutérocanoniques",
    chapters_label: "Chapitres",
    chapter_label: "Chapitre",
    versicles_label: "Versets",
    versicle_label: "Verset",
    downloading_version: "Téléchargement de {0}...",
    download_complete: "Téléchargement de {0} terminé !",
    feedback_thanks: "Merci pour votre avis !",
    link_copied: "Lien copié dans le presse-papiers !",
    favorite_added: "Verset ajouté aux favoris !",
    favorite_removed: "Favori supprimé !",
    share_text: "Découvrez cette application incroyable pour l'étude biblique !",
    current_version: "Version actuelle : {0}",
    bible_canon: "Canon Biblique",
    protestant: "Protestant",
    catholic: "Catholique",
    orthodox: "Orthodoxe",
    fluent_verse: "Verset Fluide",
    daily_verse: "Verset du Jour",
    loading_meditation: "Chargement de la méditation quotidienne...",
    deuterocanon_label: "Deutérocanonique",
    select_book: "Sélectionnez un Livre",
    select_chapter: "Sélectionnez le Chapitre",
    downloading: "Téléchargement...",
    download_full_book: "Télécharger le Livre Complet",
    offline: "Hors ligne",
    online: "En ligne",
    refresh_cache: "Recharger et Mettre à jour le Cache",
    stop_reading: "Arrêter la Lecture",
    start_reading: "Lire à Voix Haute",
    fetching_scriptures: "Recherche des écritures...",
    scripture_exploration: "Exploration des Écritures",
    deep_search: "Recherche Approfondie",
    deep_search_desc: "Sondez les profondeurs de la Parole de Dieu par thèmes, mots-clés ou références spécifiques.",
    search_placeholder_deep: "Que cherchez-vous aujourd'hui ? (ex : Amour, Foi, Salut)",
    search_btn: "Rechercher",
    suggested_themes: "Thèmes Suggérés",
    study_tip: "Conseil d'Étude",
    study_tip_desc: "Utilisez des mots-clés spécifiques ou des thèmes théologiques pour trouver des liens entre l'Ancien et le Nouveau Testament.",
    searching_scriptures: "Sondage des écritures...",
    seeking_wisdom: "Recherche de la sagesse éternelle",
    click_to_read: "Cliquez pour lire le chapitre complet",
    no_results: "Aucun résultat trouvé pour votre recherche.",
    clear_search: "Effacer la recherche",
    customization: "Personnalisation",
    customization_desc: "Personnalisez votre expérience de lecture pour la sainteté de la parole.",
    reset: "Réinitialiser",
    text_preview: "Aperçu du texte",
    preview_verse: "Au commencement était la Parole, et la Parole était avec Dieu, et la Parole était Dieu.",
    preview_ref: "Jean 1:1",
    bible_mode: "Mode Bible",
    bible_mode_desc: "Sélectionnez le canon biblique pour organiser les livres de votre bibliothèque.",
    protestant: "Protestant",
    catholic: "Catholique",
    orthodox: "Orthodoxe",
    interface_appearance: "Apparence de l'interface",
    theme_mode: "Mode thème",
    light: "Clair",
    dark: "Sombre",
    system: "Système",
    accent_color: "Couleur d'accentuation",
    accent_text_color: "Couleur du texte d'accentuation",
    tts_settings: "Lecture à voix haute (TTS)",
    voice_speed: "Vitesse de la voix",
    voice_pitch: "Hauteur de la voix",
    voice: "Voix",
    device_voice: "Voix de l'appareil",
    default_voice: "Voix par défaut",
    stored_content: "Contenu stocké",
    stored_content_desc: "Chapitres et significations originales enregistrés.",
    cache_cleared: "Cache vidé !",
    current_book: "Livre actuel",
    download_book_desc: "Téléchargez tous les chapitres de {book}.",
    select_book: "sélectionnez un livre",
    downloading: "Téléchargement...",
    download_book: "Télécharger le livre",
    full_translation: "Traduction complète",
    download_translation_desc: "Téléchargez toute la version {version} (66 livres).",
    download_all: "Tout télécharger",
    downloaded_chapters: "Chapitres téléchargés ({count})",
    no_chapters_saved: "Aucun chapitre enregistré pour le moment.",
    lamp_verse: "Ta parole est une lampe à mes pieds, et une lumière sur mon sentier.",
    lamp_ref: "Psaumes 119:105",
    select_version_desc: "Sélectionnez votre version préférée des Écritures.",
    download_full_translation: "Télécharger la traduction complète",
    original_languages: "Langues originales",
    original_languages_desc: "Accédez aux textes sacrés en hébreu, araméen et grec.",
    menu: "Menu",
    notifications: "Notifications",
    notes: "Notes",
    favorites: "Versets favoris",
    share_app: "Partager l'application",
    about_dev: "À propos du développeur",
    send_feedback: "Envoyer des commentaires",
    notes_title: "Notes",
    new_note: "Nouvelle note",
    no_reference: "Sans référence",
    note_title_placeholder: "Titre de la note...",
    note_content_placeholder: "Commencez à écrire votre réflexion...",
    confirm_delete_note: "Voulez-vous supprimer cette note ?",
    note_deleted: "Note supprimée !",
    delete: "Supprimer",
    note_saved_auto: "Note enregistrée automatiquement !",
    save: "Enregistrer",
    select_or_create_note: "Sélectionnez ou créez une note pour commencer.",
    favorites_title: "Favoris",
    category: "Catégorie",
    confirm_remove_favorite: "Retirer des favoris ?",
    removed: "Retiré !",
    no_favorites: "Vous n'avez pas encore mis de versets en favoris.",
    dev_name: "Augusto Gonçalves",
    dev_title: "(Développeur et Prédicateur de l'Évangile de Jésus-Christ)",
    dev_bio: "Dédié à la promotion de la connaissance et à l'approfondissement de la compréhension des Écritures et de la spiritualité chrétienne, je cherche à créer des outils qui rendent la Parole accessible à tous, partout.",
    dev_email: "augustogoncalvesapostly@gmail.com",
    dev_whatsapp: "+244 972 664 768",
    dev_facebook: "Shalah Augusto Gonçalves",
    dev_whatsapp_url: "https://wa.me/244972664768",
    dev_facebook_url: "https://www.facebook.com/shalah.augusto.goncalves",
    notifications_subtitle: "Restez connecté à la Parole tout au long de la journée.",
    enable_notifications: "Activer les notifications",
    enable_notifications_desc: "Recevez des alertes et des versets sur votre appareil.",
    fluent_widget: "Widget de versets fluents",
    fluent_widget_desc: "Affiche des versets périodiques sur votre écran principal.",
    daily_reminder: "Rappel de lecture quotidien",
    daily_reminder_desc: "Recevez un rappel pour lire la Bible chaque jour.",
    reminder_time: "Heure du rappel",
    notifications_active_msg: "Les notifications sont actives. Vous recevrez une portion de la Parole toutes les heures.",
    notification_test: "Test de notification",
    test_notification_now: "Tester la notification maintenant",
    back_to_library: "Retour à la bibliothèque",
    consulting_lexicons: "Consultation des lexiques originaux...",
    books: "Livres",
    reading: "Lecture",
    search: "Recherche",
    settings: "Paramètres",
    feedback_placeholder: "Écrivez votre message ici...",
    send_message: "Envoyer le message",
    confirm_action: "Confirmer l'action",
    cancel: "Annuler",
    confirm: "Confirmer",
    versions_found: "Nouvelles versions trouvées !",
    versions_error: "Erreur lors de la recherche de versions.",
    exit_fullscreen: "Quitter le plein écran",
    enter_fullscreen: "Plein écran",
    default: "Par défaut",
    copy: "Copier",
    note: "Note",
    note_in: "Note dans",
    clear: "Effacer",
    select_chapter_to_read: "Sélectionnez un chapitre pour commencer la lecture.",
    tag_love: "Amour",
    tag_forgiveness: "Pardon",
    tag_hope: "Espoir",
    tag_justice: "Justice",
    tag_peace: "Paix",
    tag_wisdom: "Sagesse",
    tag_creation: "Création",
    tag_redemption: "Rédemption",
    confirm_download_book: "Voulez-vous télécharger les {0} chapitres de {1} pour une utilisation hors ligne ? Cela peut prendre quelques minutes.",
    download_book_success: "{0} téléchargé avec succès ! {1} chapitres enregistrés.",
    download_book_error: "Une erreur est survenue lors du téléchargement de certains chapitres.",
    confirm_download_version: "Voulez-vous télécharger la traduction complète \"{0}\" pour une utilisation hors ligne ? Cela peut prendre quelques minutes.",
    download_progress: "Progression : {0}%",
    download_complete_count: "Téléchargement de {0} terminé ! {1} chapitres enregistrés.",
    lexicon_error: "Erreur lors de la recherche d'informations lexicales.",
    lexicon_loading: "Recherche d'infos lexicales...",
    lexicon_study: "Étude Lexicographique",
    lexicon_meaning: "Signification Exégétique",
    lexicon_grammar: "Analyse Grammaticale",
    lexicon_context: "Contexte Historique",
    lexicon_connections: "Connexions Linguistiques",
    lexicon_applications: "Applications et Utilisations",
    lexicon_footer: "Lexique Académique Profond",
    canon_history_title: "Histoire du Canon",
    feedback_title: "Votre avis compte",
    feedback_subtitle: "Comment pouvons-nous améliorer votre expérience d'étude ?",
    translation_kjv_desc: "Traduction classique et autorisée.",
    translation_jfa_desc: "La version la plus traditionnelle en portugais.",
    translation_niv_desc: "Langage moderne et clair.",
    translation_nvi_desc: "Équilibre entre fidélité et clarté.",
    translation_rv_desc: "La version classique en espagnol.",
    translation_lsg_desc: "La version de référence en français.",
    app_installed_success: "App installée avec succès !",
    addition_esther_greek: "Additions Grecques",
    addition_azarias: "Prière d'Azarias",
    addition_susana: "Suzanne",
    addition_bel_dragon: "Bel et le Dragon",
    with_additions: "avec additions",
    greek_additions: "additions grecques",
    tts_not_supported: "La lecture à voix haute n'est pas supportée par ce navigateur.",
    translation_vkj_pt_desc: "Traduction fidèle aux textes originaux.",
    translation_vkj_fr_desc: "Traduction fidèle aux textes originaux.",
    translation_vkj_es_desc: "Traduction fidèle aux textes originaux.",
    translation_hebrew_desc: "L'Ancien Testament dans sa langue d'origine.",
    translation_aramaic_desc: "Textes en araméen ancien.",
    translation_greek_desc: "Le Nouveau Testament en grec koinè.",
    lang_english: "Anglais",
    lang_portuguese: "Portugais",
    lang_spanish: "Espagnol",
    lang_french: "Français",
    lang_hebrew: "Hébreu",
    lang_aramaic: "Araméen",
    lang_greek: "Grec",
    color_gold: "Or",
    color_emerald: "Émeraude",
    color_ruby: "Rubis",
    color_earth: "Terre",
    color_black: "Noir",
    color_white: "Blanc",
    bibliology_btn: "Bibliologie",
    bibliology_title: "Bibliologie : {0}",
    bibliology_loading: "Sondage de l'histoire du livre...",
    bibliology_error: "Impossible de charger la bibliologie.",
    show_apocrypha: "Apocryphes",
    hide_apocrypha: "Masquer les Apocryphes",
    book_names: {
      1: "Genèse", 2: "Exode", 3: "Lévitique", 4: "Nombres", 5: "Deutéronome",
      6: "Josué", 7: "Juges", 8: "Ruth", 9: "1 Samuel", 10: "2 Samuel",
      11: "1 Rois", 12: "2 Rois", 13: "1 Chroniques", 14: "2 Chroniques",
      15: "Esdras", 16: "Néhémie", 17: "Esther", 18: "Job", 19: "Psaumes",
      20: "Proverbes", 21: "Ecclésiaste", 22: "Cantique des Cantiques", 23: "Ésaïe",
      24: "Jérémie", 25: "Lamentations", 26: "Ézéchiel", 27: "Daniel",
      28: "Osée", 29: "Joël", 30: "Amos", 31: "Abdias", 32: "Jonas",
      33: "Michée", 34: "Nahum", 35: "Habacuc", 36: "Sophonie",
      37: "Aggée", 38: "Zacharie", 39: "Malachie",
      40: "Matthieu", 41: "Marc", 42: "Luc", 43: "Jean", 44: "Actes",
      45: "Romains", 46: "1 Corinthiens", 47: "2 Corinthiens", 48: "Galates",
      49: "Éphésiens", 50: "Philippiens", 51: "Colossiens", 52: "1 Thessaloniciens",
      53: "2 Thessaloniciens", 54: "1 Timothée", 55: "2 Timothée", 56: "Tite",
      57: "Philémon", 58: "Hébreux", 59: "Jacques", 60: "1 Pierre", 61: "2 Pierre",
      62: "1 Jean", 63: "2 Jean", 64: "3 Jean", 65: "Jude", 66: "Apocalypse",
      101: "Tobie", 102: "Judith", 103: "Sagesse", 104: "Siracide",
      105: "Baruch", 106: "1 Maccabées", 107: "2 Maccabées", 108: "1 Esdras",
      109: "3 Maccabées", 110: "4 Maccabées", 111: "Prière de Manassé", 112: "Psaume 151",
      201: "Didachè", 202: "1 Clément", 203: "Épître de Barnabé", 204: "Pasteur d'Hermas",
      205: "Apocalypse de Pierre", 206: "Évangile de Thomas", 207: "Actes de Paul et Thècle",
      208: "Épître de Polycarpe", 209: "Épître aux Laodicéens", 210: "Évangile de Philippe",
      211: "Évangile de Marie de Magdala", 212: "Actes de Pierre", 213: "Actes de Jean",
      214: "Apocalypse de Paul", 215: "Prière d'Azarias", 216: "Suzanne",
      217: "Bel et le Dragon", 218: "Évangile de Judas", 219: "Apocalypse de Jacques",
      220: "Actes de Thomas", 221: "Évangile de Nicodème", 222: "Prière de Paul"
    }
  }
};

const TRANSLATIONS: Version[] = [
  { id: 'kjv', name: 'King James Version', language: 'english', description: 'translation_kjv_desc' },
  { id: 'jfa', name: 'João Ferreira de Almeida', language: 'portuguese', description: 'translation_jfa_desc' },
  { id: 'niv', name: 'New International Version', language: 'english', description: 'translation_niv_desc' },
  { id: 'nvi', name: 'Nova Versão Internacional', language: 'portuguese', description: 'translation_nvi_desc' },
  { id: 'rv', name: 'Reina-Valera', language: 'spanish', description: 'translation_rv_desc' },
  { id: 'lsg', name: 'Louis Segond', language: 'french', description: 'translation_lsg_desc' },
  { id: 'vkj_pt', name: 'Versão King James (PT)', language: 'portuguese', description: 'translation_vkj_pt_desc' },
  { id: 'vkj_fr', name: 'Version King James (FR)', language: 'french', description: 'translation_vkj_fr_desc' },
  { id: 'vkj_es', name: 'Versión King James (ES)', language: 'spanish', description: 'translation_vkj_es_desc' },
];

const ORIGINAL_LANGUAGES: Version[] = [
  { id: 'hebrew', name: 'Tanakh (Hebraico)', language: 'hebrew', description: 'translation_hebrew_desc' },
  { id: 'aramaic', name: 'Peshitta (Aramaico)', language: 'aramaic', description: 'translation_aramaic_desc' },
  { id: 'greek', name: 'Textus Receptus (Grego)', language: 'greek', description: 'translation_greek_desc' },
];

const DAILY_VERSES_BY_LANG: Record<string, Verse[]> = {
  pt_br: [
    { bookId: 43, chapter: 3, verse: 16, reference: "João 3:16", text: "Porque Deus amou o mundo de tal maneira que deu o seu Filho unigênito, para que todo aquele que nele crê não pereça, mas tenha a vida eterna." },
    { bookId: 19, chapter: 23, verse: 1, reference: "Salmos 23:1", text: "O Senhor é o meu pastor, nada me faltará." },
    { bookId: 43, chapter: 1, verse: 1, reference: "João 1:1", text: "No princípio era o Verbo, e o Verbo estava com Deus, e o Verbo era Deus." },
    { bookId: 40, chapter: 5, verse: 3, reference: "Mateus 5:3", text: "Bem-aventurados os pobres de espírito, porque deles é o reino dos céus." },
    { bookId: 45, chapter: 8, verse: 28, reference: "Romanos 8:28", text: "E sabemos que todas as coisas contribuem juntamente para o bem daqueles que amam a Deus." },
    { bookId: 1, chapter: 1, verse: 1, reference: "Gênesis 1:1", text: "No princípio criou Deus os céus e a terra." },
    { bookId: 20, chapter: 3, verse: 5, reference: "Provérbios 3:5", text: "Confia no Senhor de todo o teu coração, e não te estribes no teu próprio entendimento." },
    { bookId: 40, chapter: 11, verse: 28, reference: "Mateus 11:28", text: "Vinde a mim, todos os que estais cansados e oprimidos, e eu vos aliviarei." },
    { bookId: 50, chapter: 4, verse: 13, reference: "Filipenses 4:13", text: "Posso todas as coisas naquele que me fortalece." },
    { bookId: 58, chapter: 11, verse: 1, reference: "Hebreus 11:1", text: "Ora, a fé é o firme fundamento das coisas que se esperam, e a prova das coisas que se não veem." },
    { bookId: 19, chapter: 46, verse: 1, reference: "Salmos 46:1", text: "Deus é o nosso refúgio e fortaleza, socorro bem presente na angústia." },
    { bookId: 43, chapter: 14, verse: 6, reference: "João 14:6", text: "Disse-lhe Jesus: Eu sou o caminho, e a verdade e a vida; ninguém vem ao Pai, senão por mim." },
    { bookId: 40, chapter: 28, verse: 20, reference: "Mateus 28:20", text: "Ensinando-os a guardar todas as coisas que eu vos tenho mandado; e eis que eu estou convosco todos os dias, até a consumação dos séculos." },
  ],
  pt_pt: [
    { bookId: 43, chapter: 3, verse: 16, reference: "João 3:16", text: "Porque Deus amou o mundo de tal maneira que deu o seu Filho unigénito, para que todo aquele que nele crê não pereça, mas tenha a vida eterna." },
    { bookId: 19, chapter: 23, verse: 1, reference: "Salmos 23:1", text: "O Senhor é o meu pastor, nada me faltará." },
    { bookId: 43, chapter: 1, verse: 1, reference: "João 1:1", text: "No princípio era o Verbo, e o Verbo estava com Deus, e o Verbo era Deus." },
    { bookId: 40, chapter: 5, verse: 3, reference: "Mateus 5:3", text: "Bem-aventurados os pobres de espírito, porque deles é o reino dos céus." },
    { bookId: 45, chapter: 8, verse: 28, reference: "Romanos 8:28", text: "E sabemos que todas as coisas contribuem juntamente para o bem daqueles que amam a Deus." },
    { bookId: 1, chapter: 1, verse: 1, reference: "Génesis 1:1", text: "No princípio criou Deus os céus e a terra." },
    { bookId: 20, chapter: 3, verse: 5, reference: "Provérbios 3:5", text: "Confia no Senhor de todo o teu coração, e não te estribes no teu próprio entendimento." },
    { bookId: 40, chapter: 11, verse: 28, reference: "Mateus 11:28", text: "Vinde a mim, todos os que estais cansados e oprimidos, e eu vos aliviarei." },
    { bookId: 50, chapter: 4, verse: 13, reference: "Filipenses 4:13", text: "Posso todas as coisas naquele que me fortalece." },
    { bookId: 58, chapter: 11, verse: 1, reference: "Hebreus 11:1", text: "Ora, a fé é o firme fundamento das coisas que se esperam, e a prova das coisas que se não veem." },
    { bookId: 19, chapter: 46, verse: 1, reference: "Salmos 46:1", text: "Deus é o nosso refúgio e fortaleza, socorro bem presente na angústia." },
    { bookId: 43, chapter: 14, verse: 6, reference: "João 14:6", text: "Disse-lhe Jesus: Eu sou o caminho, e a verdade e a vida; ninguém vem ao Pai, senão por mim." },
    { bookId: 40, chapter: 28, verse: 20, reference: "Mateus 28:20", text: "Ensinando-os a guardar todas as coisas que eu vos tenho mandado; e eis que eu estou convosco todos os dias, até a consumação dos séculos." },
  ],
  en: [
    { bookId: 43, chapter: 3, verse: 16, reference: "John 3:16", text: "For God so loved the world that he gave his one and only Son, that whoever believes in him shall not perish but have eternal life." },
    { bookId: 19, chapter: 23, verse: 1, reference: "Psalm 23:1", text: "The Lord is my shepherd, I lack nothing." },
    { bookId: 43, chapter: 1, verse: 1, reference: "John 1:1", text: "In the beginning was the Word, and the Word was with God, and the Word was God." },
    { bookId: 40, chapter: 5, verse: 3, reference: "Matthew 5:3", text: "Blessed are the poor in spirit, for theirs is the kingdom of heaven." },
    { bookId: 45, chapter: 8, verse: 28, reference: "Romans 8:28", text: "And we know that in all things God works for the good of those who love him." },
    { bookId: 1, chapter: 1, verse: 1, reference: "Genesis 1:1", text: "In the beginning God created the heavens and the earth." },
    { bookId: 20, chapter: 3, verse: 5, reference: "Proverbs 3:5", text: "Trust in the Lord with all your heart and lean not on your own understanding." },
    { bookId: 40, chapter: 11, verse: 28, reference: "Matthew 11:28", text: "Come to me, all you who are weary and burdened, and I will give you rest." },
    { bookId: 50, chapter: 4, verse: 13, reference: "Philippians 4:13", text: "I can do all this through him who gives me strength." },
    { bookId: 58, chapter: 11, verse: 1, reference: "Hebrews 11:1", text: "Now faith is confidence in what we hope for and assurance about what we do not see." },
    { bookId: 19, chapter: 46, verse: 1, reference: "Psalm 46:1", text: "God is our refuge and strength, an ever-present help in trouble." },
    { bookId: 43, chapter: 14, verse: 6, reference: "John 14:6", text: "Jesus answered, 'I am the way and the truth and the life. No one comes to the Father except through me.'" },
    { bookId: 40, chapter: 28, verse: 20, reference: "Matthew 28:20", text: "And teaching them to obey everything I have commanded you. And surely I am with you always, to the very end of the age." },
  ],
  es: [
    { bookId: 43, chapter: 3, verse: 16, reference: "Juan 3:16", text: "Porque de tal manera amó Dios al mundo, que ha dado a su Hijo unigénito, para que todo aquel que en él cree, no se pierda, mas tenga vida eterna." },
    { bookId: 19, chapter: 23, verse: 1, reference: "Salmos 23:1", text: "Jehová es mi pastor; nada me faltará." },
    { bookId: 43, chapter: 1, verse: 1, reference: "Juan 1:1", text: "En el principio era el Verbo, y el Verbo era con Dios, y el Verbo era Dios." },
    { bookId: 40, chapter: 5, verse: 3, reference: "Mateo 5:3", text: "Bienaventurados los pobres en espíritu, porque de ellos es el reino de los cielos." },
    { bookId: 45, chapter: 8, verse: 28, reference: "Romanos 8:28", text: "Y sabemos que a los que aman a Dios, todas las cosas les ayudan a bien." },
    { bookId: 1, chapter: 1, verse: 1, reference: "Génesis 1:1", text: "En el principio creó Dios los cielos y la tierra." },
    { bookId: 20, chapter: 3, verse: 5, reference: "Proverbios 3:5", text: "Fíate de Jehová de todo tu corazón, y no te apoyes en tu propia prudencia." },
    { bookId: 40, chapter: 11, verse: 28, reference: "Mateo 11:28", text: "Venid a mí todos los que estáis trabajados y cargados, y yo os haré descansar." },
    { bookId: 50, chapter: 4, verse: 13, reference: "Filipenses 4:13", text: "Todo lo puedo en Cristo que me fortalece." },
    { bookId: 58, chapter: 11, verse: 1, reference: "Hebreos 11:1", text: "Es, pues, la fe la certeza de lo que se espera, la convicción de lo que no se ve." },
    { bookId: 19, chapter: 46, verse: 1, reference: "Salmos 46:1", text: "Dios es nuestro amparo y fortaleza, nuestro pronto auxilio en las tribulaciones." },
    { bookId: 43, chapter: 14, verse: 6, reference: "Juan 14:6", text: "Jesús le dijo: Yo soy el camino, y la verdad, y la vida; nadie viene al Padre, sino por mí." },
    { bookId: 40, chapter: 28, verse: 20, reference: "Mateo 28:20", text: "Enseñándoles que guarden todas las cosas que os he mandado; y he aquí yo estoy con vosotros todos los días, hasta el fin del mundo. Amén." },
  ],
  fr: [
    { bookId: 43, chapter: 3, verse: 16, reference: "Jean 3:16", text: "Car Dieu a tant aimé le monde qu'il a donné son Fils unique, afin que quiconque croit en lui ne périsse point, mais qu'il ait la vie éternelle." },
    { bookId: 19, chapter: 23, verse: 1, reference: "Psaume 23:1", text: "L'Éternel est mon berger: je ne manquerai de rien." },
    { bookId: 43, chapter: 1, verse: 1, reference: "Jean 1:1", text: "Au commencement était la Parole, et la Parole était avec Dieu, et la Parole était Dieu." },
    { bookId: 40, chapter: 5, verse: 3, reference: "Matthieu 5:3", text: "Heureux les pauvres en esprit, car le royaume des cieux est à eux!" },
    { bookId: 45, chapter: 8, verse: 28, reference: "Romains 8:28", text: "Nous savons, du reste, que toutes choses concourent au bien de ceux qui aiment Dieu." },
    { bookId: 1, chapter: 1, verse: 1, reference: "Genèse 1:1", text: "Au commencement, Dieu créa les cieux et la terre." },
    { bookId: 20, chapter: 3, verse: 5, reference: "Proverbes 3:5", text: "Confie-toi en l'Éternel de tout ton cœur, et ne t'appuie pas sur ta sagesse." },
    { bookId: 40, chapter: 11, verse: 28, reference: "Matthieu 11:28", text: "Venez à moi, vous tous qui êtes fatigués et chargés, et je vous donnerai du repos." },
    { bookId: 50, chapter: 4, verse: 13, reference: "Philippiens 4:13", text: "Je puis tout par celui qui me fortifie." },
    { bookId: 58, chapter: 11, verse: 1, reference: "Hébreux 11:1", text: "Or la foi est une ferme assurance des choses qu'on espère, une démonstration de celles qu'on ne voit pas." },
    { bookId: 19, chapter: 46, verse: 1, reference: "Psaume 46:1", text: "Dieu est pour nous un refuge et un appui, un secours qui ne manque jamais dans la détresse." },
    { bookId: 43, chapter: 14, verse: 6, reference: "Jean 14:6", text: "Jésus lui dit: Je suis le chemin, la vérité, et la vie. Nul ne vient au Père que par moi." },
    { bookId: 40, chapter: 28, verse: 20, reference: "Matthieu 28:20", text: "Et enseignez-leur à observer tout ce que je vous ai prescrit. Et voici, je suis avec vous tous les jours, jusqu'à la fin du monde." },
  ]
};

// --- Components ---

interface LexiconData {
  word: string;
  original: string;
  transliteration: string;
  pronunciation: string;
  strongs: string;
  definition: string;
  grammar: string;
  historicalContext: string;
  applications: string[];
  etymology: {
    primary: string; // Hebrew for OT, Greek for NT
    secondary?: string; // LXX for OT, Aramaic for NT/specific books
    aramaic?: string;
  };
}

// --- Components ---

const LexiconCard = React.forwardRef(({ data, onClose, t }: { data: LexiconData | null, onClose: () => void, t: (key: string) => string }, ref: React.Ref<HTMLDivElement>) => {
  if (!data) return null;
  return (
    <motion.div 
      ref={ref}
    initial={{ opacity: 0, y: 100 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: 100 }}
    className="fixed bottom-0 left-0 right-0 lg:left-auto lg:right-12 lg:bottom-12 lg:w-[32rem] bg-surface-container-high rounded-t-[3rem] lg:rounded-[3rem] shadow-2xl border-t lg:border border-primary/10 z-[70] max-h-[85vh] overflow-y-auto custom-scrollbar"
  >
    <div className="sticky top-0 bg-surface-container-high/90 backdrop-blur-md p-8 pb-4 flex justify-between items-start z-10">
      <div>
        <span className="font-label text-[10px] uppercase tracking-[0.3em] text-secondary font-bold mb-2 block">{t('lexicon_study')}</span>
        <h4 className="font-body italic text-5xl text-primary leading-none">{data.original}</h4>
        <div className="flex items-center gap-3 mt-2">
          <p className="font-headline text-xs font-black text-secondary uppercase tracking-widest">{data.transliteration}</p>
          <span className="w-1 h-1 rounded-full bg-primary/20"></span>
          <p className="font-label text-[10px] text-on-surface/40 uppercase tracking-widest">Strongs {data.strongs}</p>
        </div>
      </div>
      <button onClick={onClose} className="p-3 bg-surface-container-highest rounded-full hover:bg-primary hover:text-white transition-all shadow-sm">
        <span className="material-symbols-outlined text-xl">close</span>
      </button>
    </div>

    <div className="p-8 pt-0 space-y-8">
      {/* Pronunciation & Etymology */}
      <div className="grid grid-cols-2 gap-4">
        <div className="p-4 bg-surface-container-low rounded-2xl border border-primary/5">
          <p className="font-label text-[9px] uppercase tracking-widest text-on-surface/40 mb-1">{t('lexicon_pronunciation')}</p>
          <p className="font-body italic text-lg text-primary">{data.pronunciation}</p>
        </div>
        <div className="p-4 bg-surface-container-low rounded-2xl border border-primary/5">
          <p className="font-label text-[9px] uppercase tracking-widest text-on-surface/40 mb-1">{t('lexicon_primary_root')}</p>
          <p className="font-body italic text-lg text-secondary">{data.etymology.primary}</p>
        </div>
      </div>

      {/* Definition */}
      <section>
        <h5 className="font-headline text-sm font-bold uppercase tracking-widest text-primary mb-3 flex items-center gap-2">
          <span className="material-symbols-outlined text-xs">translate</span>
          {t('lexicon_meaning')}
        </h5>
        <p className="text-xl font-body leading-relaxed text-on-surface/80 italic">&quot;{data.definition}&quot;</p>
      </section>

      {/* Grammar & Context */}
      <div className="space-y-6">
        <div className="p-6 bg-primary/5 rounded-[2rem] border border-primary/10">
          <h5 className="font-label text-[10px] uppercase tracking-widest text-primary font-bold mb-3">{t('lexicon_grammar')}</h5>
          <p className="text-sm font-body leading-relaxed text-on-surface/70">{data.grammar}</p>
        </div>

        <div className="p-6 bg-secondary/5 rounded-[2rem] border border-secondary/10">
          <h5 className="font-label text-[10px] uppercase tracking-widest text-secondary font-bold mb-3">{t('lexicon_context')}</h5>
          <p className="text-sm font-body leading-relaxed text-on-surface/70">{data.historicalContext}</p>
        </div>
      </div>

      {/* Etymology Details */}
      {(data.etymology.secondary || data.etymology.aramaic) && (
        <section className="space-y-4">
          <h5 className="font-headline text-sm font-bold uppercase tracking-widest text-primary mb-3">{t('lexicon_connections')}</h5>
          <div className="grid grid-cols-1 gap-3">
            {data.etymology.secondary && (
              <div className="flex justify-between items-center p-4 bg-surface-container-highest rounded-xl">
                <span className="font-label text-[10px] uppercase tracking-widest text-on-surface/40">{t('lexicon_lxx_greek')}</span>
                <span className="font-body italic text-secondary">{data.etymology.secondary}</span>
              </div>
            )}
            {data.etymology.aramaic && (
              <div className="flex justify-between items-center p-4 bg-surface-container-highest rounded-xl">
                <span className="font-label text-[10px] uppercase tracking-widest text-on-surface/40">{t('lexicon_biblical_aramaic')}</span>
                <span className="font-body italic text-secondary">{data.etymology.aramaic}</span>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Applications */}
      <section>
        <h5 className="font-headline text-sm font-bold uppercase tracking-widest text-primary mb-4">{t('lexicon_applications')}</h5>
        <ul className="space-y-3">
          {data.applications.map((app, i) => (
            <li key={i} className="flex gap-3 items-start">
              <span className="w-1.5 h-1.5 rounded-full bg-secondary mt-2 shrink-0"></span>
              <p className="text-sm font-body text-on-surface/70 italic">{app}</p>
            </li>
          ))}
        </ul>
      </section>

      <div className="pt-6 border-t border-primary/10 flex justify-between items-center opacity-40">
        <span className="font-label text-[9px] uppercase tracking-[0.2em]">{t('lexicon_footer')}</span>
        <span className="material-symbols-outlined text-sm">verified</span>
      </div>
    </div>
  </motion.div>
  );
});
LexiconCard.displayName = 'LexiconCard';

export default function BibleApp() {
  const { scrollY } = useScroll();
  const bookY = useTransform(scrollY, [0, 1000], [0, -150]);
  const bookRotate = useTransform(scrollY, [0, 1000], [0, 15]);

  const [activeView, setActiveView] = useState<View>('library');
  const [canonHistoryTab, setCanonHistoryTab] = useState<'protestant' | 'catholic' | 'orthodox' | 'historical' | 'all'>('all');
  const [mounted, setMounted] = useState(false);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [selectedChapter, setSelectedChapter] = useState<number | null>(null);
  const [selectedVersion, setSelectedVersion] = useState<Version>(TRANSLATIONS[1]); // Default to JFA
  const [lexiconData, setLexiconData] = useState<LexiconData | null>(null);
  const [isFetchingLexicon, setIsFetchingLexicon] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<number | null>(null);
  const [selectedVerses, setSelectedVerses] = useState<number[]>([]);
  const [favorites, setFavorites] = useState<FavoriteVerse[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [activeNote, setActiveNote] = useState<Note | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [deepSearchQuery, setDeepSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Verse[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [dailyVerse, setDailyVerse] = useState<Verse | null>(null);
  const [appLanguage, setAppLanguage] = useState<AppLanguage>('system');
  const [dynamicTranslations, setDynamicTranslations] = useState<Version[]>([]);
  const [versionSearchQuery, setVersionSearchQuery] = useState('');
  const [isSearchingVersions, setIsSearchingVersions] = useState(false);
  const [showApocrypha, setShowApocrypha] = useState(false);
  const [isBibliologyOpen, setIsBibliologyOpen] = useState(false);
  const [bibliologyContent, setBibliologyContent] = useState<string | null>(null);
  const [isLoadingBibliology, setIsLoadingBibliology] = useState(false);

  const getActiveLang = useCallback(() => {
    if (appLanguage === 'system') {
      const systemLang = (typeof navigator !== 'undefined' && mounted) ? navigator.language.split('-')[0] : 'pt_br';
      const fullSystemLang = (typeof navigator !== 'undefined' && mounted) ? navigator.language.toLowerCase() : 'pt-br';
      if (fullSystemLang === 'pt-br') return 'pt_br';
      if (fullSystemLang.startsWith('pt')) return 'pt_pt';
      return ['en', 'es', 'fr'].includes(systemLang) ? systemLang : 'pt_br';
    }
    return appLanguage;
  }, [appLanguage, mounted]);

  const t = useCallback((key: string, ...args: (string | number)[]) => {
    const lang = getActiveLang();
    
    let str = "";
    if (key.startsWith('book_')) {
      const bookId = parseInt(key.replace('book_', ''));
      str = (UI_STRINGS[lang as keyof typeof UI_STRINGS]?.book_names as Record<number, string>)?.[bookId] || (UI_STRINGS['pt_br']?.book_names as Record<number, string>)?.[bookId] || key;
    } else {
      str = (UI_STRINGS[lang as keyof typeof UI_STRINGS]?.[key as keyof (typeof UI_STRINGS)['pt_br']] as string) || (UI_STRINGS['pt_br']?.[key as keyof (typeof UI_STRINGS)['pt_br']] as string) || key;
    }

    if (args.length > 0) {
      args.forEach((arg, i) => {
        str = str.replace(`{${i}}`, arg.toString());
      });
    }
    return str;
  }, [getActiveLang]);

  const fetchBibliology = async (bookName: string) => {
    if (isLoadingBibliology) return;
    setIsLoadingBibliology(true);
    setIsBibliologyOpen(true);
    setBibliologyContent(null);
    
    try {
      const cached = await getBibliology(bookName);
      if (cached) {
        setBibliologyContent(cached.content);
        setIsLoadingBibliology(false);
        return;
      }

      const ai = new GoogleGenAI({ apiKey: process.env.NEXT_PUBLIC_GEMINI_API_KEY! });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Forneça uma bibliologia detalhada para o livro bíblico "${bookName}". 
        Inclua as seguintes seções formatadas em Markdown:
        1. **História e Objetivo**: O propósito pelo qual o livro foi escrito.
        2. **Autor**: Informações sobre quem escreveu o livro.
        3. **Situação Histórica**: O contexto em que o livro foi escrito.
        4. **Datação**: Quando o livro foi escrito.
        5. **Temas Principais**: Os pontos teológicos centrais.
        
        Use um tom acadêmico e respeitoso. Responda em ${getActiveLang() === 'en' ? 'English' : getActiveLang() === 'es' ? 'Spanish' : 'Portuguese'}.`,
      });
      
      const content = response.text || "Não foi possível gerar a bibliologia.";
      setBibliologyContent(content);
      if (response.text) {
        await saveBibliology(bookName, content);
      }
    } catch (error) {
      console.error("Erro ao gerar bibliologia:", error);
      setBibliologyContent("Erro ao carregar informações bibliológicas. Verifique sua conexão.");
    } finally {
      setIsLoadingBibliology(false);
    }
  };

  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' | 'info' } | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{ message: string, onConfirm: () => void } | null>(null);

  // Update daily verse when language changes
  useEffect(() => {
    if (mounted) {
      const lang = getActiveLang();
      const verses = DAILY_VERSES_BY_LANG[lang] || DAILY_VERSES_BY_LANG['pt_br'];
      setDailyVerse(prev => {
        if (!prev) return verses[Math.floor(Math.random() * verses.length)];
        // Try to find the same verse in the new language
        const sameVerse = verses.find(v => v.bookId === prev.bookId && v.chapter === prev.chapter && v.verse === prev.verse);
        return sameVerse || verses[Math.floor(Math.random() * verses.length)];
      });
    }
  }, [appLanguage, mounted, getActiveLang]);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Settings State
  const [fontSize, setFontSize] = useState(18);
  const [accentColor, setAccentColor] = useState('#775a19'); // Secondary color
  const [accentTextColor, setAccentTextColor] = useState('#ffffff'); // Text on secondary color
  const [fontFamily, setFontFamily] = useState('Newsreader');
  const [themeMode, setThemeMode] = useState<'light' | 'dark' | 'system'>('light');
  const [bibleMode, setBibleMode] = useState<'protestant' | 'catholic' | 'orthodox'>('protestant');
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [widgetEnabled, setWidgetEnabled] = useState(false);
  const [dailyReminderEnabled, setDailyReminderEnabled] = useState(false);
  const [dailyReminderTime, setDailyReminderTime] = useState('08:00');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [randomVerse, setRandomVerse] = useState<Verse | null>(null);

  // Load Settings, Favorites, and Notes
  useEffect(() => {
    setMounted(true);

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').then((reg) => {
        console.log('Service Worker registrado com sucesso:', reg);
      }).catch((err) => {
        console.error('Falha ao registrar Service Worker:', err);
      });
    }

    const saved = localStorage.getItem('biblia_settings');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.fontSize) setFontSize(parsed.fontSize);
        if (parsed.fontFamily) setFontFamily(parsed.fontFamily);
        if (parsed.accentColor) setAccentColor(parsed.accentColor);
        if (parsed.accentTextColor) setAccentTextColor(parsed.accentTextColor);
        if (parsed.themeMode) setThemeMode(parsed.themeMode);
        if (parsed.bibleMode) setBibleMode(parsed.bibleMode);
        if (parsed.notificationsEnabled !== undefined) setNotificationsEnabled(parsed.notificationsEnabled);
        if (parsed.widgetEnabled !== undefined) setWidgetEnabled(parsed.widgetEnabled);
        if (parsed.dailyReminderEnabled !== undefined) setDailyReminderEnabled(parsed.dailyReminderEnabled);
        if (parsed.dailyReminderTime) setDailyReminderTime(parsed.dailyReminderTime);
        if (parsed.appLanguage) setAppLanguage(parsed.appLanguage);
        if (parsed.dynamicTranslations) setDynamicTranslations(parsed.dynamicTranslations);
      } catch (e) {
        console.error("Failed to load settings", e);
      }
    }

    const savedFavorites = localStorage.getItem('biblia_favorites');
    if (savedFavorites) setFavorites(JSON.parse(savedFavorites));

    const savedNotes = localStorage.getItem('biblia_notes');
    if (savedNotes) setNotes(JSON.parse(savedNotes));
  }, []);

  // Initial daily verse setup
  useEffect(() => {
    if (mounted && !dailyVerse) {
      const lang = getActiveLang();
      const verses = DAILY_VERSES_BY_LANG[lang] || DAILY_VERSES_BY_LANG['pt_br'];
      setDailyVerse(verses[Math.floor(Math.random() * verses.length)]);
    }
  }, [mounted, getActiveLang, dailyVerse]);



  // Save Favorites and Notes
  useEffect(() => {
    localStorage.setItem('biblia_favorites', JSON.stringify(favorites));
  }, [favorites]);

  useEffect(() => {
    localStorage.setItem('biblia_notes', JSON.stringify(notes));
  }, [notes]);

  // Save Settings
  useEffect(() => {
    localStorage.setItem('biblia_settings', JSON.stringify({
      fontSize, fontFamily, accentColor, accentTextColor, themeMode, bibleMode, notificationsEnabled, widgetEnabled, dailyReminderEnabled, dailyReminderTime, appLanguage, dynamicTranslations
    }));
  }, [fontSize, fontFamily, accentColor, accentTextColor, themeMode, bibleMode, notificationsEnabled, widgetEnabled, dailyReminderEnabled, dailyReminderTime, appLanguage, dynamicTranslations]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable full-screen mode: ${err.message}`);
      });
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
        setIsFullscreen(false);
      }
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const [chapterContent, setChapterContent] = useState<{ verse: number, text: string }[]>([]);
  const [isLoadingContent, setIsLoadingContent] = useState(false);

  // Notification logic
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (notificationsEnabled && widgetEnabled) {
      interval = setInterval(() => {
        if (Notification.permission === 'granted') {
          const lang = getActiveLang();
          const verses = DAILY_VERSES_BY_LANG[lang] || DAILY_VERSES_BY_LANG['pt_br'];
          const verse = verses[Math.floor(Math.random() * verses.length)];
          new Notification(t('verse_of_the_moment'), {
            body: `"${verse.text}" - ${verse.reference}`,
            icon: '/icon.svg',
            badge: '/icon.svg',
            tag: 'fluent-verse'
          });
        }
      }, 1000 * 60 * 60); // Every hour
    }
    return () => clearInterval(interval);
  }, [notificationsEnabled, widgetEnabled, t, getActiveLang]);

  // Daily Reminder logic
  useEffect(() => {
    let timeout: NodeJS.Timeout;
    if (notificationsEnabled && dailyReminderEnabled) {
      const checkReminder = () => {
        const now = new Date();
        const [hours, minutes] = dailyReminderTime.split(':').map(Number);
        const reminderTime = new Date();
        reminderTime.setHours(hours, minutes, 0, 0);

        if (now.getHours() === hours && now.getMinutes() === minutes) {
          if (Notification.permission === 'granted') {
            new Notification(t('reading_reminder'), {
              body: t('reading_reminder_body'),
              icon: '/icon.svg',
              badge: '/icon.svg',
              tag: 'daily-reminder'
            });
          }
        }

        // Check again in 1 minute
        timeout = setTimeout(checkReminder, 60000);
      };
      checkReminder();
    }
    return () => clearTimeout(timeout);
  }, [notificationsEnabled, dailyReminderEnabled, dailyReminderTime, t]);

  // Random Verse Widget logic
  useEffect(() => {
    if (widgetEnabled) {
      const lang = getActiveLang();
      const verses = DAILY_VERSES_BY_LANG[lang] || DAILY_VERSES_BY_LANG['pt_br'];
      setRandomVerse(verses[Math.floor(Math.random() * verses.length)]);
      const interval = setInterval(() => {
        const currentLang = getActiveLang();
        const currentVerses = DAILY_VERSES_BY_LANG[currentLang] || DAILY_VERSES_BY_LANG['pt_br'];
        setRandomVerse(currentVerses[Math.floor(Math.random() * currentVerses.length)]);
      }, 10000); // Every 10 seconds
      return () => clearInterval(interval);
    } else {
      setRandomVerse(null);
    }
  }, [widgetEnabled, getActiveLang]);

  const requestNotificationPermission = async () => {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        setNotificationsEnabled(true);
        new Notification(t('notifications_enabled'), {
          body: t('notifications_enabled_body'),
          icon: '/icon.svg',
          badge: '/icon.svg'
        });
      } else {
        setNotificationsEnabled(false);
        showToast(t('notification_permission_denied'), 'error');
      }
    } else {
      showToast(t('notifications_not_supported'), 'error');
    }
  };

  // TTS State
  const [isReadingAloud, setIsReadingAloud] = useState(false);
  const [speechRate, setSpeechRate] = useState(1);
  const [selectedVoice, setSelectedVoice] = useState<string>('');
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);

  useEffect(() => {
    // Register Service Worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js')
        .then(reg => console.log('SW Registered', reg))
        .catch(err => console.error('SW Registration Failed', err));
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
    };

    const handleAppInstalled = () => {
      showToast(t('app_installed_success'), 'success');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, [t]);


  const [cachedChapters, setCachedChapters] = useState<string[]>([]);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Load cached chapters list
  useEffect(() => {
    const loadCache = async () => {
      const chapters = await getAllCachedChapters();
      setCachedChapters(chapters.map(c => c.id));
    };
    loadCache();
  }, []);

  // Apply Settings
  useEffect(() => {
    const root = document.documentElement;
    
    // Font Size
    root.style.setProperty('--app-font-size', `${fontSize}px`);
    
    // Font Family
    const fontMap: Record<string, string> = {
      'Newsreader': 'var(--font-newsreader)',
      'Manrope': 'var(--font-manrope)',
      'Comfortaa': 'var(--font-comfortaa)',
      'Manuscrito': 'var(--font-manuscrito)',
      'Negritos': 'var(--font-negritos)',
      'System': 'ui-sans-serif'
    };
    root.style.setProperty('--app-font-body', fontMap[fontFamily] || fontMap['Newsreader']);
    
    // Accent Color & Primary
    root.style.setProperty('--app-secondary', accentColor);
    root.style.setProperty('--app-on-secondary', accentTextColor);
    
    // If it's the default green, keep primary as green. Otherwise, derive primary from accent.
    if (accentColor === '#00342b') {
      root.style.setProperty('--app-primary', '#00342b');
      root.style.setProperty('--app-on-primary', accentTextColor);
    } else if (accentColor === '#000000') {
      root.style.setProperty('--app-primary', '#000000');
      root.style.setProperty('--app-on-primary', accentTextColor);
    } else if (accentColor === '#ffffff') {
      root.style.setProperty('--app-primary', '#ffffff');
      root.style.setProperty('--app-on-primary', accentTextColor);
    } else {
      root.style.setProperty('--app-primary', accentColor);
      root.style.setProperty('--app-on-primary', accentTextColor);
    }
    
    // Theme
    const updateTheme = () => {
      const isDark = themeMode === 'dark' || (themeMode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
      if (isDark) {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    };

    updateTheme();

    if (themeMode === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      mediaQuery.addEventListener('change', updateTheme);
      return () => mediaQuery.removeEventListener('change', updateTheme);
    }
  }, [fontSize, fontFamily, accentColor, accentTextColor, themeMode]);

  // TTS Logic
  useEffect(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;

    const updateVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      setAvailableVoices(voices.filter(v => v.lang.startsWith('pt') || v.lang.startsWith('en')));
    };
    
    window.speechSynthesis.addEventListener('voiceschanged', updateVoices);
    updateVoices();

    return () => {
      window.speechSynthesis.removeEventListener('voiceschanged', updateVoices);
      window.speechSynthesis.cancel();
    };
  }, []);

  const toggleReadAloud = () => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      showToast(t('tts_not_supported'), 'error');
      return;
    }

    if (isReadingAloud || window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
      setIsReadingAloud(false);
      return;
    }

    if (chapterContent.length === 0) return;

    const textToRead = chapterContent.map(v => `${v.verse}. ${v.text}`).join(' ');
    const utterance = new SpeechSynthesisUtterance(textToRead);
    utteranceRef.current = utterance;
    
    const voice = availableVoices.find(v => v.name === selectedVoice);
    if (voice) utterance.voice = voice;
    utterance.rate = speechRate;
    utterance.lang = 'pt-BR';

    utterance.onstart = () => setIsReadingAloud(true);
    utterance.onend = () => {
      setIsReadingAloud(false);
      utteranceRef.current = null;
    };
    utterance.onerror = () => {
      setIsReadingAloud(false);
      utteranceRef.current = null;
    };

    window.speechSynthesis.resume();
    window.speechSynthesis.speak(utterance);
    // Force state if onstart is delayed
    setIsReadingAloud(true);
  };

  const resetSettings = () => {
    setFontSize(18);
    setAccentColor('#775a19');
    setFontFamily('Newsreader');
    setThemeMode('light');
    setBibleMode('protestant');
    setSpeechRate(1);
    setSelectedVoice('');
  };

  const downloadFullBook = async () => {
    if (!selectedBook || isLoadingContent) return;
    
    setConfirmDialog({
      message: t('confirm_download_book', selectedBook.caps, t('book_' + selectedBook.id)),
      onConfirm: async () => {
        setConfirmDialog(null);
        setIsLoadingContent(true);
        setDownloadProgress(0);
        try {
          let successCount = 0;
          for (let i = 1; i <= selectedBook.caps; i++) {
            const content = await fetchChapterContent(t('book_' + selectedBook.id), i, false);
            if (content) successCount++;
            setDownloadProgress(Math.round((i / selectedBook.caps) * 100));
            // Small delay to avoid rate limits
            await new Promise(r => setTimeout(r, 500));
          }
          showToast(t('download_book_success', t('book_' + selectedBook.id), successCount), 'success');
        } catch (error) {
          console.error("Erro ao baixar livro:", error);
          showToast(t('download_book_error'), 'error');
        } finally {
          setIsLoadingContent(false);
          setDownloadProgress(null);
        }
      }
    });
  };

  const handleVerseSelection = (verseNum: number) => {
    setSelectedVerses(prev => 
      prev.includes(verseNum) ? prev.filter(v => v !== verseNum) : [...prev, verseNum]
    );
  };

  const copySelectedVerses = () => {
    const text = selectedVerses
      .sort((a, b) => a - b)
      .map(vNum => {
        const v = chapterContent.find(c => c.verse === vNum);
        return `${vNum}. ${v?.text}`;
      })
      .join('\n');
    const reference = `${t('book_' + selectedBook?.id)} ${selectedChapter}:${selectedVerses.join(',')}`;
    navigator.clipboard.writeText(`${reference}\n\n${text}`);
    setSelectedVerses([]);
    showToast(t('link_copied'), 'success');
  };

  const favoriteSelectedVerses = (color: string) => {
    const newFavs = selectedVerses.map(vNum => {
      const v = chapterContent.find(c => c.verse === vNum);
      return {
        id: `${selectedBook!.id}-${selectedChapter}-${vNum}-${Date.now()}`,
        bookId: selectedBook!.id,
        bookName: t('book_' + selectedBook!.id),
        chapter: selectedChapter!,
        verse: vNum,
        text: v!.text,
        color,
        createdAt: Date.now()
      };
    });
    setFavorites(prev => [...prev, ...newFavs]);
    setSelectedVerses([]);
    showToast(t('favorite_added'), 'success');
  };



  const addNoteFromSelection = () => {
    const reference = `${t('book_' + selectedBook?.id)} ${selectedChapter}:${selectedVerses.join(',')}`;
    const newNote: Note = {
      id: Date.now().toString(),
      title: `${t('note_in')} ${reference}`,
      content: '',
      reference,
      createdAt: Date.now()
    };
    setNotes(prev => [newNote, ...prev]);
    setActiveNote(newNote);
    setIsMenuOpen(true);
    setActiveView('notes');
    setSelectedVerses([]);
  };

  const sendFeedback = () => {
    if (!feedbackMessage.trim()) return;
    window.location.href = `mailto:augustogoncalvesapostly@gmail.com?subject=Feedback Biblia App&body=${encodeURIComponent(feedbackMessage)}`;
    setFeedbackMessage('');
    showToast(t('feedback_thanks'), 'success');
  };

  const shareApp = () => {
    const shareData = {
      title: t('app_title'),
      text: t('share_text'),
      url: window.location.href
    };
    if (navigator.share) {
      navigator.share(shareData);
    } else {
      navigator.clipboard.writeText(window.location.href);
      showToast(t('link_copied'), 'success');
    }
  };
  const getEnglishBookName = (bookId: number) => {
    return (UI_STRINGS['en']?.book_names as Record<number, string>)?.[bookId] || "Genesis";
  };

  const fetchChapterContent = useCallback(async (bookId: number, chapter: number, forceFetch = false, versionOverride?: Version) => {
    const version = versionOverride || selectedVersion;
    if (!versionOverride) setIsLoadingContent(true);
    try {
      if (!forceFetch) {
        const cached = await getChapter(version.id, bookId, chapter);
        if (cached) {
          if (!versionOverride) {
            setChapterContent(cached.content);
            setIsLoadingContent(false);
          }
          return cached.content;
        }
      }

      const ai = new GoogleGenAI({ apiKey: process.env.NEXT_PUBLIC_GEMINI_API_KEY || '' });
      const bookNameEn = getEnglishBookName(bookId);
      
      const model = ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [{ role: 'user', parts: [{ text: `Provide the full text of chapter ${chapter} of the book of ${bookNameEn} of the Bible (version ${version.name}). Return only a JSON array in the format: [{"verse": 1, "text": "..."}, ...]. Do not include explanations or markdown formatting. RESPOND IN THE LANGUAGE: ${version.language}.` }] }],
      });
      
      const response = await model;
      const text = response.text;
      if (!text) throw new Error("Resposta vazia da IA");
      
      // Robust JSON extraction
      const jsonMatch = text.match(/\[\s*\{[\s\S]*\}\s*\]/);
      if (!jsonMatch) throw new Error("JSON não encontrado na resposta");
      
      const parsed = JSON.parse(jsonMatch[0]);
      if (!versionOverride) setChapterContent(parsed);
      
      // Auto-cache after search
      await saveChapter(version.id, bookId, chapter, parsed);
      setCachedChapters(prev => [...new Set([...prev, `${version.id}-${bookId}-${chapter}`])]);
      return parsed;
    } catch (error) {
      console.error("Erro ao buscar conteúdo:", error);
      if (!versionOverride) {
        const bookName = t('book_' + bookId);
        setChapterContent([
          { verse: 1, text: t('chapter_content_fallback_1', chapter, bookName) },
          { verse: 2, text: t('chapter_content_fallback_2') }
        ]);
      }
      return null;
    } finally {
      if (!versionOverride) setIsLoadingContent(false);
    }
  }, [selectedVersion, t]);

  const downloadFullTranslation = async (version: Version) => {
    setConfirmDialog({
      message: t('confirm_download_version', version.name),
      onConfirm: async () => {
        setConfirmDialog(null);
        setIsLoadingContent(true);
        setDownloadProgress(0);
        showToast(t('downloading_version', version.name), 'info');
        
        let successCount = 0;
        const totalChapters = BIBLE_BOOKS.reduce((acc, book) => acc + book.caps, 0);
        let currentChapter = 0;

        for (const book of BIBLE_BOOKS) {
          for (let cap = 1; cap <= book.caps; cap++) {
            try {
              await fetchChapterContent(book.id, cap, false, version);
              successCount++;
              // Small delay to avoid rate limits
              await new Promise(r => setTimeout(r, 300));
            } catch (e) {
              console.error(`Failed to download ${t('book_' + book.id)} ${cap}`, e);
            }
            currentChapter++;
            setDownloadProgress(Math.round((currentChapter / totalChapters) * 100));
            if (currentChapter % 50 === 0) {
              showToast(t('download_progress', Math.round((currentChapter / totalChapters) * 100)), 'info');
            }
          }
        }
        
        const cached = await getAllCachedChapters();
        setCachedChapters(cached.map(c => c.id));
        showToast(t('download_complete_count', version.name, successCount), 'success');
        setIsLoadingContent(false);
        setDownloadProgress(null);
      }
    });
  };


  useEffect(() => {
    if (selectedBook && selectedChapter) {
      fetchChapterContent(selectedBook.id, selectedChapter);
    }
  }, [selectedBook, selectedChapter, fetchChapterContent]);

  const filteredBooks = getSortedBooks(bibleMode).filter(book => {
    const bookName = t(`book_${book.id}`);
    const matchesSearch = bookName.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  const handleSearchVersions = async () => {
    if (!versionSearchQuery.trim()) return;
    setIsSearchingVersions(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.NEXT_PUBLIC_GEMINI_API_KEY || '' });
      const model = ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [{ role: 'user', parts: [{ text: `Search for Bible versions related to: "${versionSearchQuery}". Return a list of up to 5 versions in JSON format: [{"id": "string_slug", "name": "Version Name", "language": "Language", "description": "Brief description"}]. Respond in the language: ${getActiveLang()}. Do not include markdown.` }] }],
      });
      const response = await model;
      const text = response.text;
      if (!text) throw new Error("Resposta vazia da IA");
      
      const jsonMatch = text.match(/\[\s*\{[\s\S]*\}\s*\]/);
      if (!jsonMatch) throw new Error("JSON não encontrado na resposta");
      
      const parsed = JSON.parse(jsonMatch[0]);
      setDynamicTranslations(prev => {
        const existingIds = new Set([...TRANSLATIONS, ...prev].map(t => t.id));
        const newOnes = parsed.filter((p: { id: string }) => !existingIds.has(p.id));
        return [...prev, ...newOnes];
      });
      showToast(t('versions_found'), 'success');
    } catch (e) {
      console.error(e);
      showToast(t('versions_error'), 'error');
    } finally {
      setIsSearchingVersions(false);
    }
  };
  const handleSearch = async (query: string) => {
    if (!query.trim()) return;
    setIsSearching(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.NEXT_PUBLIC_GEMINI_API_KEY || '' });
      const model = ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [{ role: 'user', parts: [{ text: `Search the Bible (version ${selectedVersion.name}) for verses related to: "${query}". Return a list of up to 10 verses in JSON format: [{"bookId": number, "chapter": number, "verse": number, "text": "...", "reference": "..."}]. Use standard book IDs (1-66). Respond in the language: ${getActiveLang()}. Do not include explanations or markdown.` }] }],
      });
      
      const response = await model;
      const text = response.text;
      if (!text) throw new Error("Resposta vazia da IA");
      
      const jsonMatch = text.match(/\[\s*\{[\s\S]*\}\s*\]/);
      if (!jsonMatch) throw new Error("JSON não encontrado na resposta");
      
      const parsed = JSON.parse(jsonMatch[0]);
      setSearchResults(parsed);
    } catch (error) {
      console.error("Erro na pesquisa:", error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleBookClick = (book: Book, chapter: number | null = null) => {
    setSelectedBook(book);
    setSelectedChapter(chapter);
    setActiveView('read');
  };

  const handleVerseClick = (verse: Verse) => {
    const book = BIBLE_BOOKS.find(b => b.id === verse.bookId);
    if (book) {
      handleBookClick(book, verse.chapter);
    }
  };

  const showLexicon = async (word: string, verseText: string, reference: string, silent = false) => {
    if (!silent) setIsFetchingLexicon(true);
    try {
      const cached = await getLexicon(word, reference);
      if (cached) {
        if (!silent) {
          setLexiconData(cached.content);
          setIsFetchingLexicon(false);
        }
        return;
      }

      const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error("API Key not configured");
      }

      const ai = new GoogleGenAI({ apiKey });
      const activeLang = getActiveLang();
      const prompt = `Analyze the word "${word}" in the context of the verse: "${verseText}" (${reference}) of the Bible (version ${selectedVersion.name}).
      Provide a deep lexical study in JSON format. RESPOND IN THE LANGUAGE: ${activeLang}.
      {
        "word": "${word}",
        "original": "word in original (Hebrew/Greek)",
        "transliteration": "transliteration",
        "pronunciation": "phonetic pronunciation",
        "strongs": "Strong's number",
        "definition": "detailed exegetical meaning",
        "grammar": "grammatical context (morphology, syntax)",
        "historicalContext": "historical and cultural context of the word",
        "applications": ["list of different forms of application and uses"],
        "etymology": {
          "primary": "primary etymology (Hebrew for OT, Greek for NT)",
          "secondary": "Septuagintal Greek (for OT) or Aramaic (for NT) transliteration",
          "aramaic": "Biblical Aramaic (if applicable)"
        }
      }
      If the word is a translation addition, identify the original word it completes. Return only the JSON.`;

      const model = ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
      });
      
      const response = await model;
      const text = response.text;
      if (!text) throw new Error("Resposta vazia da IA");
      
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("JSON não encontrado na resposta");
      const parsed = JSON.parse(jsonMatch[0]);
      if (!silent) setLexiconData(parsed);
      await saveLexicon(word, reference, parsed);
    } catch (error) {
      console.error("Erro ao buscar léxico:", error);
      if (!silent) showToast(t('lexicon_error'), 'error');
    } finally {
      if (!silent) setIsFetchingLexicon(false);
    }
  };

  if (!mounted) {
    return <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
    </div>;
  }

  return (
    <div className="min-h-screen flex flex-col bg-background text-on-surface">
      {/* TopAppBar */}
      <header className="fixed top-0 left-0 w-full flex items-center justify-between px-6 h-14 bg-background/90 backdrop-blur-xl z-50 shadow-sm border-b border-primary/10">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setIsMenuOpen(true)}
            className="p-2 menu-glow rounded-full transition-all border border-primary/10 bg-surface-container-low"
          >
            <span className="material-symbols-outlined text-primary">more_vert</span>
          </button>
          <h1 className="font-headline font-bold text-sm tracking-tight text-primary uppercase flex">
            {t('app_title').split('').map((char, i) => (
              <motion.span
                key={i}
                animate={{ y: [0, -4, 0] }}
                transition={{
                  duration: 3,
                  repeat: Infinity,
                  delay: i * 0.1,
                  ease: "easeInOut"
                }}
                className={char === ' ' ? 'mr-1' : ''}
              >
                {char}
              </motion.span>
            ))}
          </h1>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={toggleFullscreen}
            className="p-2 hover:bg-primary/5 rounded-full transition-colors text-primary"
            title={isFullscreen ? t('exit_fullscreen') : t('enter_fullscreen')}
          >
            <span className="material-symbols-outlined">{isFullscreen ? 'fullscreen_exit' : 'fullscreen'}</span>
          </button>
          <div className="font-body italic text-secondary hidden sm:block">{t('tagline')}</div>
        </div>
      </header>

      <main className="flex-1 pt-20 pb-28 px-6 max-w-7xl mx-auto w-full">
        <AnimatePresence mode="wait">
          {activeView === 'library' && (
            <motion.div 
              key="library"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-8"
            >
              {/* Library Header */}
              <header className="space-y-8">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
                  <div className="space-y-3">
                    <h1 className="text-5xl md:text-7xl font-headline font-black text-primary tracking-tighter leading-none">{t('library')}</h1>
                    <div className="flex items-center gap-3">
                      <div className="h-[2px] w-12 bg-secondary/30"></div>
                      <p className="text-sm font-label text-on-surface/40 uppercase tracking-[0.4em] font-bold">{t('tagline')}</p>
                    </div>
                  </div>
                  <div className="bg-surface-container-high p-1.5 rounded-full flex gap-1 shadow-inner border border-primary/5">
                    <button 
                      onClick={() => setActiveView('translations')}
                      className="px-8 py-3 rounded-full font-label text-xs font-bold bg-surface-container-low text-primary shadow-sm hover:bg-surface-container-high transition-all active:scale-95"
                    >
                      {t('translations')}
                    </button>
                    <button 
                      onClick={() => setActiveView('original_languages')}
                      className="px-8 py-3 rounded-full font-label text-xs font-bold text-on-surface/50 hover:bg-surface-container-low/50 transition-all active:scale-95"
                    >
                      {t('original_languages')}
                    </button>
                  </div>
                </div>

                <div className="flex flex-col lg:flex-row gap-6 items-center justify-between bg-surface-container-low/40 p-8 rounded-[3.5rem] border border-primary/10 shadow-sm backdrop-blur-sm">
                  <div className="relative flex-1 w-full max-w-2xl group">
                    <span className="material-symbols-outlined absolute left-6 top-1/2 -translate-y-1/2 text-primary/30 group-focus-within:text-primary transition-colors">search</span>
                    <input 
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-surface-container-high/40 border-2 border-transparent focus:border-primary/10 rounded-full py-5 pl-16 pr-8 font-label text-base focus:ring-4 focus:ring-primary/5 transition-all outline-none placeholder:text-on-surface/30" 
                      placeholder={t('search_placeholder')} 
                      type="text"
                    />
                  </div>
                  
                  <div className="flex flex-col sm:flex-row items-center gap-6 w-full lg:w-auto">
                    <div className="flex flex-col items-center sm:items-start">
                      <span className="font-label text-[10px] uppercase tracking-[0.2em] font-black text-secondary/60 mb-2 ml-2">{t('bible_canon')}</span>
                      <div className="flex flex-row items-center bg-surface-container-high p-1.5 rounded-full w-full sm:w-fit shadow-inner border border-primary/5 overflow-x-auto no-scrollbar">
                        {(['protestant', 'catholic', 'orthodox'] as const).map((mode) => (
                          <button
                            key={mode}
                            onClick={() => setBibleMode(mode)}
                            className={`px-4 sm:px-6 py-2.5 rounded-full font-label text-[10px] font-bold uppercase tracking-widest transition-all whitespace-nowrap ${bibleMode === mode ? 'bg-primary text-on-primary shadow-lg scale-105' : 'text-on-surface/40 hover:bg-surface-container-low'}`}
                          >
                            {t(mode)}
                          </button>
                        ))}
                      </div>
                      
                      <button
                        onClick={() => {
                          setCanonHistoryTab(bibleMode);
                          setActiveView('canon_history');
                        }}
                        className="flex items-center gap-2 px-4 py-2 bg-primary/5 text-primary rounded-full font-label text-[10px] font-bold uppercase tracking-widest hover:bg-primary/10 transition-all border border-primary/10"
                      >
                        <span className="material-symbols-outlined text-[16px]">history_edu</span>
                        {t('history_btn')}
                      </button>
                    </div>
                  </div>
                </div>
              </header>

              <section className="space-y-12">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="lg:col-span-2 bg-primary-container text-white rounded-[2.5rem] p-8 flex items-end relative overflow-hidden h-64 md:h-72 group shadow-lg">
                    <motion.div 
                      style={{ y: bookY, rotate: bookRotate }}
                      className="absolute -top-12 -right-12 p-0 opacity-10 group-hover:scale-110 group-hover:opacity-20 transition-all duration-1000 pointer-events-none"
                    >
                      <span className="material-symbols-outlined text-[20rem] md:text-[30rem]">auto_stories</span>
                    </motion.div>
                    <div className="relative z-10 space-y-3">
                      <div className="space-y-1">
                        <span className="font-label text-[10px] uppercase tracking-[0.4em] font-bold text-white/60">{t('app_title')}</span>
                        <h2 className="text-4xl md:text-5xl font-headline font-black tracking-tighter leading-none">{t('tagline')}</h2>
                      </div>
                      <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md px-3 py-1.5 rounded-full w-fit border border-white/10">
                        <span className="material-symbols-outlined text-xs">verified</span>
                        <p className="text-[10px] font-label font-bold tracking-widest uppercase text-white/80">{t('current_version', selectedVersion.name)}</p>
                      </div>
                    </div>
                  </div>

                  {widgetEnabled && randomVerse ? (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      key={randomVerse.reference}
                      onClick={() => handleVerseClick(randomVerse)}
                      className="bg-tertiary-container text-on-tertiary-container rounded-[2.5rem] p-8 flex flex-col justify-between h-64 md:h-72 cursor-pointer hover:shadow-xl transition-all group relative overflow-hidden border border-tertiary/10"
                    >
                      {/* Background Image for Versículo Fluente */}
                      <div className="absolute inset-0 opacity-10 group-hover:opacity-30 transition-opacity duration-1000 dark:bg-black/40">
                        <Image 
                          src="https://picsum.photos/seed/spirit/800/800"
                          alt="Spiritual Background"
                          fill
                          className="object-cover scale-110 group-hover:scale-100 transition-transform duration-1000"
                          referrerPolicy="no-referrer"
                        />
                      </div>

                      <div className="w-12 h-12 rounded-2xl bg-tertiary flex items-center justify-center text-white group-hover:scale-110 group-hover:rotate-6 transition-all relative z-10 shadow-md">
                        <span className="material-symbols-outlined text-2xl">auto_awesome</span>
                      </div>
                      <div className="relative z-10">
                        <h3 className="font-headline font-bold text-xl mb-1">{t('fluent_verse')}</h3>
                        <p className="text-xs opacity-80 italic line-clamp-2 mb-1">&quot;{randomVerse.text}&quot;</p>
                        <span className="font-label text-[9px] uppercase tracking-widest font-bold">
                          {t('book_' + randomVerse.bookId)} {randomVerse.chapter}:{randomVerse.verse}
                        </span>
                      </div>
                    </motion.div>
                  ) : (
                    <div 
                      onClick={() => dailyVerse && handleVerseClick(dailyVerse)}
                      className="bg-secondary-container text-on-secondary-container rounded-[2.5rem] p-8 flex flex-col justify-between h-64 md:h-72 cursor-pointer hover:shadow-xl transition-all group relative overflow-hidden"
                    >
                      {/* Background Image for Versículo do Dia */}
                      <div className="absolute inset-0 opacity-20 group-hover:opacity-30 transition-opacity duration-700 dark:bg-black/40">
                        <Image 
                          src="https://picsum.photos/seed/bible/800/800"
                          alt="Bible Background"
                          fill
                          className="object-cover"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                      
                      <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center text-on-secondary group-hover:scale-110 transition-transform relative z-10">
                        <span className="material-symbols-outlined">star</span>
                      </div>
                      <div className="relative z-10">
                        <h3 className="font-headline font-bold text-xl mb-1">{t('daily_verse')}</h3>
                        {dailyVerse ? (
                          <>
                            <p className="text-xs opacity-80 italic line-clamp-2 mb-1">&quot;{dailyVerse.text}&quot;</p>
                            <span className="font-label text-[9px] uppercase tracking-widest font-bold">
                              {t('book_' + dailyVerse.bookId)} {dailyVerse.chapter}:{dailyVerse.verse}
                            </span>
                          </>
                        ) : (
                          <p className="text-xs opacity-80 italic">{t('loading_meditation')}</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </section>

              {/* Canon Grid */}
              <section className="space-y-12 pb-12">
                {/* Antigo Testamento */}
                {filteredBooks.some(b => b.type === 'ot' || b.type === 'deuterocanon') && (
                  <div className="space-y-6">
                    <div className="flex items-center gap-4">
                      <div className="flex flex-col">
                        <h2 className="font-headline font-black text-3xl text-primary tracking-tight leading-none">{t('ot_title')}</h2>
                        <span className="font-label text-[10px] uppercase tracking-[0.3em] text-secondary/60 mt-1">{t('ot_subtitle')}</span>
                      </div>
                      <div className="h-[1px] flex-1 bg-gradient-to-r from-primary/20 to-transparent"></div>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 sm:gap-3">
                      {filteredBooks.filter(b => b.type === 'ot' || b.type === 'deuterocanon').map(book => (
                        <div key={book.id} className="space-y-1.5">
                          <button 
                            onClick={() => handleBookClick(book)}
                            className="w-full group bg-surface-container-low hover:bg-primary hover:text-white p-4 sm:p-6 rounded-[1.5rem] sm:rounded-[2rem] transition-all cursor-pointer shadow-sm text-center flex flex-col items-center justify-center min-h-[80px] sm:min-h-[100px]"
                          >
                            <h4 className="font-headline font-bold text-sm sm:text-lg leading-tight">{t(`book_${book.id}`)}</h4>
                            {book.type === 'deuterocanon' && (
                              <span className="text-[8px] uppercase tracking-widest opacity-50 block mt-1">{t('deuterocanon_label')}</span>
                            )}
                          </button>
                          {book.additions && (bibleMode === 'catholic' || bibleMode === 'orthodox') && (
                            <div className="ml-1 sm:ml-2 space-y-1">
                              {book.additions.map(addition => (
                                <button
                                  key={addition.id}
                                  onClick={() => handleBookClick({ ...book, id: addition.id, name: t(addition.name_key), caps: 1 })}
                                  className="w-full text-left px-2 py-1 bg-secondary/5 hover:bg-secondary/10 rounded-lg transition-all border border-secondary/10"
                                >
                                  <span className="text-[9px] font-medium text-secondary">+ {t(addition.name_key)}</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Novo Testamento */}
                {filteredBooks.some(b => b.type === 'nt') && (
                  <div className="space-y-6">
                    <div className="flex items-center gap-4">
                      <div className="flex flex-col">
                        <h2 className="font-headline font-black text-3xl text-primary tracking-tight leading-none">{t('nt_title')}</h2>
                        <span className="font-label text-[10px] uppercase tracking-[0.3em] text-secondary/60 mt-1">{t('nt_subtitle')}</span>
                      </div>
                      <div className="h-[1px] flex-1 bg-gradient-to-r from-primary/20 to-transparent"></div>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 sm:gap-3">
                      {filteredBooks.filter(b => b.type === 'nt').map(book => (
                        <button 
                          key={book.id}
                          onClick={() => handleBookClick(book)}
                          className="group bg-surface-container-low hover:bg-primary hover:text-white p-4 sm:p-6 rounded-[1.5rem] sm:rounded-[2rem] transition-all cursor-pointer shadow-sm text-center flex flex-col items-center justify-center min-h-[80px] sm:min-h-[100px]"
                        >
                          <h4 className="font-headline font-bold text-sm sm:text-lg leading-tight">{t(`book_${book.id}`)}</h4>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Apócrifos Toggle */}
                {filteredBooks.some(b => b.type === 'apocrypha_nt') && (
                  <div className="pt-8 border-t border-primary/5">
                    <button 
                      onClick={() => setShowApocrypha(!showApocrypha)}
                      className="w-full flex items-center justify-between p-6 rounded-[2rem] bg-surface-container-low hover:bg-surface-container-high transition-all group border border-primary/5"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-primary/5 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                          <span className="material-symbols-outlined text-2xl">history_edu</span>
                        </div>
                        <div className="text-left">
                          <h3 className="font-headline font-bold text-xl text-primary leading-none">{t('show_apocrypha')}</h3>
                          <p className="font-label text-[10px] uppercase tracking-widest text-secondary/60 mt-1">{t('apocrypha_subtitle')}</p>
                        </div>
                      </div>
                      <span className={`material-symbols-outlined text-primary transition-transform duration-300 ${showApocrypha ? 'rotate-180' : ''}`}>
                        expand_more
                      </span>
                    </button>

                    <AnimatePresence>
                      {showApocrypha && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.3, ease: "easeInOut" }}
                          className="overflow-hidden"
                        >
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-8">
                            {filteredBooks.filter(b => b.type === 'apocrypha_nt').map((book) => (
                              <div 
                                key={book.id} 
                                onClick={() => handleBookClick(book)}
                                className="p-6 rounded-[2rem] bg-surface-container-low border border-primary/10 hover:shadow-lg hover:border-primary/20 transition-all cursor-pointer group"
                              >
                                <div className="flex justify-between items-start mb-2">
                                  <h5 className="font-headline font-bold text-secondary group-hover:text-primary transition-colors">{t(`book_${book.id}`)}</h5>
                                  <span className="material-symbols-outlined text-xs text-primary opacity-0 group-hover:opacity-100 transition-opacity">menu_book</span>
                                </div>
                                <p className="text-[10px] font-label text-on-surface/50 uppercase tracking-widest">
                                  {book.caps} {book.caps === 1 ? t('chapter_label') : t('chapters_label')}
                                </p>
                              </div>
                            ))}
                          </div>
                          
                          <div className="flex justify-center pb-8">
                            <button
                              onClick={() => {
                                setCanonHistoryTab('historical');
                                setActiveView('canon_history');
                              }}
                              className="flex items-center gap-2 px-6 py-3 bg-secondary/10 text-secondary rounded-full font-label text-xs font-bold uppercase tracking-widest hover:bg-secondary/20 transition-all border border-secondary/20"
                            >
                              <span className="material-symbols-outlined">history_edu</span>
                              {t('apocrypha_history')}
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}
              </section>
            </motion.div>
          )}

          {activeView === 'read' && (
            <motion.div 
              key="read"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-3xl mx-auto"
            >
                <div className="flex flex-col gap-8">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <span className="font-label text-secondary font-bold uppercase text-xs tracking-widest block">
                        {selectedBook?.type === 'ot' ? t('ot_title') : 
                         selectedBook?.type === 'nt' ? t('nt_title') : 
                         selectedBook?.type === 'deuterocanon' ? t('deuterocanon_title') : t('apocrypha_title')}
                      </span>
                      <h2 className="text-5xl md:text-6xl font-headline font-black text-primary">
                        {selectedBook ? t('book_' + selectedBook.id) : t('select_book')}
                      </h2>
                    </div>
                    <button 
                      onClick={downloadFullBook}
                      disabled={isLoadingContent}
                      className="flex items-center justify-center gap-3 px-6 py-4 rounded-2xl bg-primary/5 text-primary hover:bg-primary/10 transition-all border border-primary/10 disabled:opacity-50 w-full sm:w-auto"
                    >
                      {isLoadingContent ? (
                        <span className="material-symbols-outlined text-xl animate-spin">sync</span>
                      ) : (
                        <span className="material-symbols-outlined text-xl">download</span>
                      )}
                      <span className="font-label text-xs font-bold uppercase tracking-widest">
                        {isLoadingContent ? (downloadProgress !== null ? `${downloadProgress}%` : t('downloading')) : t('download_full_book')}
                      </span>
                    </button>
                  </div>

                  {selectedBook && (
                    <div className="space-y-8">
                      {/* Bibliology Button */}
                      <button 
                        onClick={() => fetchBibliology(t('book_' + selectedBook.id))}
                        className="w-full flex items-center justify-center gap-3 p-4 rounded-2xl bg-secondary/10 text-secondary hover:bg-secondary/20 transition-all border border-secondary/10 group"
                      >
                        <span className="material-symbols-outlined text-2xl group-hover:rotate-12 transition-transform">history_edu</span>
                        <span className="font-label text-xs font-bold uppercase tracking-widest">{t('bibliology_btn')}</span>
                      </button>

                      <div className="space-y-4">
                        <span className="font-label text-[10px] uppercase tracking-widest font-bold text-secondary ml-2">{t('select_chapter')}</span>
                        <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 gap-3">
                          {Array.from({ length: selectedBook.caps }, (_, i) => i + 1).map(cap => (
                            <button 
                              key={cap}
                              onClick={() => setSelectedChapter(cap)}
                              className={`aspect-square rounded-2xl font-headline font-bold text-sm transition-all flex items-center justify-center ${selectedChapter === cap ? 'bg-primary text-on-primary shadow-lg scale-110' : 'bg-surface-container-high hover:bg-primary/10'}`}
                            >
                              {cap}
                            </button>
                          ))}
                        </div>
                      </div>

                      {selectedChapter && !isLoadingContent && (
                        <motion.div 
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="flex flex-col items-stretch gap-4 p-6 bg-surface-container-low rounded-[2.5rem] border border-primary/5 shadow-md"
                        >
                          <div className="flex items-center gap-3 px-5 py-3 bg-surface-container-high rounded-2xl border border-primary/10 justify-center">
                            <span className={`w-2.5 h-2.5 rounded-full ${cachedChapters.includes(`${selectedVersion.id}-${selectedBook?.id}-${selectedChapter}`) ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.6)]' : 'bg-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.6)]'}`}></span>
                            <span className="font-label text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                              {cachedChapters.includes(`${selectedVersion.id}-${selectedBook?.id}-${selectedChapter}`) ? t('offline') : t('online')}
                            </span>
                          </div>
                          
                          <div className="flex flex-col sm:flex-row gap-4">
                            <button 
                              onClick={() => fetchChapterContent(selectedBook!.id, selectedChapter!, true)}
                              className="h-14 flex items-center justify-center rounded-2xl bg-surface-container-high text-primary border border-primary/10 hover:bg-primary/5 transition-all group px-6"
                              title={t('refresh_cache')}
                            >
                              <span className="material-symbols-outlined text-2xl group-hover:rotate-180 transition-transform duration-500 mr-3">refresh</span>
                              <span className="font-label text-xs font-bold uppercase tracking-widest sm:hidden">{t('refresh_cache')}</span>
                            </button>
                            
                            <button 
                              onClick={toggleReadAloud}
                              className={`flex-1 flex items-center justify-center gap-4 py-4 px-8 rounded-2xl shadow-lg transition-all ${isReadingAloud ? 'bg-secondary text-on-secondary' : 'bg-primary text-on-primary'}`}
                              title={isReadingAloud ? t('stop_reading') : t('start_reading')}
                            >
                              <span className="material-symbols-outlined text-2xl">
                                {isReadingAloud ? 'stop_circle' : 'volume_up'}
                              </span>
                              <span className="font-label text-xs font-bold uppercase tracking-widest">
                                {isReadingAloud ? t('stop_reading') : t('start_reading')}
                              </span>
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </div>
                  )}
                </div>
              
              <div className="leading-[1.6] space-y-8 bible-text">
                {selectedChapter ? (
                  <div className="animate-in fade-in duration-500">
                    <h3 className="font-body italic text-2xl text-secondary mb-8">{t('chapter_label')} {selectedChapter}</h3>
                    
                    {isLoadingContent ? (
                      <div className="flex flex-col items-center justify-center py-20 space-y-4">
                        <motion.div 
                          animate={{ rotate: 360 }}
                          transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                          className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full"
                        />
                        <p className="text-lg font-body italic text-secondary">{t('fetching_scriptures')}</p>
                      </div>
                    ) : (
                      <>
                        <div className="space-y-4">
                          {chapterContent.map((v) => {
                            const isSelected = selectedVerses.includes(v.verse);
                            const favorite = favorites.find(f => f.bookId === selectedBook?.id && f.chapter === selectedChapter && f.verse === v.verse);
                            
                            return (
                              <div key={v.verse} className={`group relative p-3 rounded-2xl transition-all ${isSelected ? 'bg-primary/5 ring-1 ring-primary/20' : ''}`}>
                                <div className="flex items-baseline">
                                  <button 
                                    onClick={() => handleVerseSelection(v.verse)}
                                    className={`text-[10px] font-label mr-4 w-6 h-6 rounded-full flex items-center justify-center transition-all shrink-0 ${isSelected ? 'bg-primary text-on-primary' : 'text-secondary bg-secondary/5 group-hover:bg-primary/10'}`}
                                  >
                                    {v.verse}
                                  </button>
                                  <div className={`flex-1 ${favorite ? 'border-l-4 pl-4' : ''}`} style={{ borderLeftColor: favorite?.color, direction: (selectedVersion.language === 'hebrew' || selectedVersion.language === 'aramaic') ? 'rtl' : 'ltr', textAlign: (selectedVersion.language === 'hebrew' || selectedVersion.language === 'aramaic') ? 'right' : 'left' }}>
                                    {v.text.split(' ').map((word, i) => (
                                      <span 
                                        key={i} 
                                        className="verse-word hover:text-secondary transition-colors cursor-pointer inline"
                                        onClick={() => showLexicon(word, v.text, `${t('book_' + selectedBook?.id)} ${selectedChapter}:${v.verse}`)}
                                      >
                                        {word}{' '}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* Floating Selection Toolbar */}
                        <AnimatePresence>
                          {selectedVerses.length > 0 && (
                            <motion.div 
                              initial={{ opacity: 0, y: 20 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: 20 }}
                              className="fixed bottom-32 left-1/2 -translate-x-1/2 bg-surface-container-high border border-primary/10 shadow-2xl rounded-full px-6 py-3 flex items-center gap-6 z-[60]"
                            >
                              <div className="flex items-center gap-2 border-r border-primary/10 pr-4">
                                {['#fef08a', '#bbf7d0', '#bfdbfe', '#fbcfe8', '#ddd6fe'].map(color => (
                                  <button 
                                    key={color}
                                    onClick={() => favoriteSelectedVerses(color)}
                                    className="w-6 h-6 rounded-full border border-black/5 hover:scale-110 transition-transform"
                                    style={{ backgroundColor: color }}
                                  />
                                ))}
                              </div>
                              <button onClick={copySelectedVerses} className="flex flex-col items-center gap-1 text-on-surface/60 hover:text-primary transition-colors">
                                <span className="material-symbols-outlined text-xl">content_copy</span>
                                <span className="text-[8px] font-bold uppercase">{t('copy')}</span>
                              </button>
                              <button onClick={addNoteFromSelection} className="flex flex-col items-center gap-1 text-on-surface/60 hover:text-primary transition-colors">
                                <span className="material-symbols-outlined text-xl">edit_note</span>
                                <span className="text-[8px] font-bold uppercase">{t('note')}</span>
                              </button>
                              <button onClick={() => setSelectedVerses([])} className="flex flex-col items-center gap-1 text-on-surface/60 hover:text-destructive transition-colors">
                                <span className="material-symbols-outlined text-xl">close</span>
                                <span className="text-[8px] font-bold uppercase">{t('clear')}</span>
                              </button>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-20 text-on-surface/30 italic text-2xl">
                    {t('select_chapter_to_read')}
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {activeView === 'search' && (
            <motion.div 
              key="search"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-5xl mx-auto space-y-16"
            >
              {/* Hero Header */}
              <section className="relative py-12 text-center md:text-left">
                <div className="absolute -left-16 -top-8 opacity-5 select-none pointer-events-none hidden lg:block">
                  <span className="text-[16rem] font-headline font-black leading-none tracking-tighter uppercase">{t('search_btn')}</span>
                </div>
                <div className="relative z-10">
                  <span className="font-label text-xs font-bold uppercase tracking-[0.4em] text-secondary mb-4 block">{t('scripture_exploration')}</span>
                  <h2 className="text-6xl md:text-8xl font-headline font-black text-primary leading-none tracking-tight">
                    {t('deep_search').split(' ')[0]} <br className="hidden md:block" />
                    <span className="text-secondary italic font-body font-light">{t('deep_search').split(' ')[1]}</span>
                  </h2>
                  <p className="mt-6 text-xl text-on-surface/60 max-w-2xl font-body italic">
                    {t('deep_search_desc')}
                  </p>
                </div>
              </section>

              {/* Search Bar Section */}
              <section className="relative group">
                <div className="absolute -inset-1 bg-gradient-to-r from-primary/20 to-secondary/20 rounded-[3rem] blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
                <div className="relative flex items-center bg-surface-container-low rounded-[3rem] border border-primary/10 shadow-xl overflow-hidden">
                  <div className="pl-8 pr-4 text-primary">
                    <span className="material-symbols-outlined text-3xl">search</span>
                  </div>
                  <input 
                    value={deepSearchQuery}
                    onChange={(e) => setDeepSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch(deepSearchQuery)}
                    className="flex-1 bg-transparent py-8 text-2xl md:text-3xl font-body italic outline-none placeholder:text-on-surface/20" 
                    placeholder={t('search_placeholder_deep')}
                  />
                  <button 
                    onClick={() => handleSearch(deepSearchQuery)}
                    className="mr-4 px-8 py-4 bg-primary text-on-primary rounded-full font-label text-xs font-bold uppercase tracking-widest hover:bg-secondary transition-all shadow-lg active:scale-95"
                  >
                    {t('search_btn')}
                  </button>
                </div>
              </section>

              {/* Suggestions / Results */}
              <section className="space-y-12">
                {!isSearching && searchResults.length === 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                    <div className="space-y-6">
                      <h3 className="font-headline text-lg font-bold uppercase tracking-widest text-secondary flex items-center gap-2">
                        <span className="material-symbols-outlined text-sm">trending_up</span>
                        {t('suggested_themes')}
                      </h3>
                      <div className="flex flex-wrap gap-3">
                        {['tag_love', 'tag_forgiveness', 'tag_hope', 'tag_justice', 'tag_peace', 'tag_wisdom', 'tag_creation', 'tag_redemption'].map(tagKey => (
                          <button 
                            key={tagKey}
                            onClick={() => {
                              setDeepSearchQuery(t(tagKey));
                              handleSearch(t(tagKey));
                            }}
                            className="px-6 py-3 bg-surface-container-high rounded-full font-label text-xs font-semibold text-primary hover:bg-primary hover:text-white transition-all border border-primary/5"
                          >
                            {t(tagKey)}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="bg-primary-container/10 rounded-[2.5rem] p-8 border border-primary/5">
                      <h3 className="font-headline text-lg font-bold uppercase tracking-widest text-primary mb-4">{t('study_tip')}</h3>
                      <p className="font-body italic text-on-surface/70 leading-relaxed">
                        {t('study_tip_desc')}
                      </p>
                    </div>
                  </div>
                )}

                {isSearching ? (
                  <div className="flex flex-col items-center justify-center py-32 space-y-6">
                    <motion.div 
                      animate={{ rotate: 360 }}
                      transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                      className="w-16 h-16 border-4 border-primary/10 border-t-primary rounded-full"
                    />
                    <div className="text-center">
                      <p className="text-2xl font-body italic text-primary">{t('searching_scriptures')}</p>
                      <p className="text-sm font-label text-on-surface/40 uppercase tracking-widest mt-2">{t('seeking_wisdom')}</p>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-8">
                    {searchResults.length > 0 ? (
                      searchResults.map((result, idx) => (
                        <motion.div 
                          key={idx}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: idx * 0.05 }}
                          onClick={() => handleVerseClick(result)}
                          className="group relative bg-surface-container-low p-10 rounded-[3rem] border border-primary/10 shadow-sm hover:shadow-2xl hover:border-secondary/30 transition-all cursor-pointer overflow-hidden"
                        >
                          <div className="absolute top-0 right-0 p-10 opacity-5 group-hover:opacity-10 transition-opacity">
                            <span className="material-symbols-outlined text-8xl">format_quote</span>
                          </div>
                          <div className="relative z-10">
                            <div className="flex justify-between items-center mb-6">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-secondary/10 flex items-center justify-center text-secondary">
                                  <span className="material-symbols-outlined text-sm">auto_stories</span>
                                </div>
                                <span className="font-label text-xs text-secondary font-black uppercase tracking-[0.2em]">{result.reference}</span>
                              </div>
                              <span className="material-symbols-outlined text-on-surface/20 group-hover:text-primary group-hover:translate-x-1 transition-all">arrow_forward_ios</span>
                            </div>
                            <p className="text-xl md:text-2xl font-body leading-tight group-hover:text-primary transition-colors italic">&quot;{result.text}&quot;</p>
                            <div className="mt-8 flex items-center gap-4 opacity-0 group-hover:opacity-100 transition-opacity">
                              <span className="h-[1px] w-12 bg-secondary/30"></span>
                              <span className="font-label text-[10px] uppercase tracking-widest text-secondary font-bold">{t('click_to_read')}</span>
                            </div>
                          </div>
                        </motion.div>
                      ))
                    ) : deepSearchQuery && !isSearching ? (
                      <div className="text-center py-32 bg-surface-container-high/30 rounded-[3rem] border border-dashed border-primary/20">
                        <span className="material-symbols-outlined text-6xl text-on-surface/10 mb-4">sentiment_dissatisfied</span>
                        <p className="text-2xl font-body italic text-on-surface/40">{t('no_results')}</p>
                        <button 
                          onClick={() => setDeepSearchQuery('')}
                          className="mt-6 text-primary font-label text-xs font-bold uppercase tracking-widest hover:underline"
                        >
                          {t('clear_search')}
                        </button>
                      </div>
                    ) : null}
                  </div>
                )}
              </section>
            </motion.div>
          )}

          {activeView === 'settings' && (
            <motion.div 
              key="settings"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="max-w-4xl mx-auto space-y-8"
            >
              {/* Hero Header */}
              <section className="relative py-8">
                <div className="absolute -left-12 top-0 opacity-5 select-none pointer-events-none">
                  <span className="text-[12rem] font-headline font-extrabold leading-none">LEX</span>
                </div>
                <h2 className="font-headline text-5xl font-extrabold tracking-tight text-primary mb-2">{t('customization')}</h2>
                <div className="flex justify-between items-start gap-4">
                  <p className="font-body text-xl text-on-surface-variant max-w-lg">{t('customization_desc')}</p>
                  <button 
                    onClick={resetSettings}
                    className="px-6 py-2 rounded-full border border-primary/20 text-primary font-label text-xs font-bold uppercase tracking-widest hover:bg-primary/5 transition-all"
                  >
                    {t('reset')}
                  </button>
                </div>
              </section>

              {/* Preview Section */}
              <section className="bg-surface-container-low p-8 rounded-[3rem] border border-primary/10 shadow-inner">
                <h3 className="font-label text-[10px] uppercase tracking-[0.3em] text-secondary font-bold mb-6">{t('text_preview')}</h3>
                <div className="space-y-4 bible-text">
                  <p className="text-on-surface leading-relaxed transition-all">
                    &quot;{t('preview_verse')}&quot;
                  </p>
                  <p className="font-label text-xs text-secondary uppercase tracking-widest">— {t('preview_ref')}</p>
                </div>
              </section>

              {/* Interface Appearance */}
              <section className="space-y-10 pt-6">
                <h3 className="font-headline text-lg font-bold uppercase tracking-widest text-secondary">{t('bible_mode')}</h3>
                <div className="bg-surface-container-high p-8 rounded-[2.5rem] space-y-6">
                  <p className="font-body text-lg text-on-surface-variant">{t('bible_mode_desc')}</p>
                  <div className="flex flex-row items-center bg-black/5 p-1.5 rounded-full text-center text-xs font-bold overflow-x-auto no-scrollbar">
                    <button 
                      onClick={() => setBibleMode('protestant')}
                      className={`flex-1 py-3 rounded-full cursor-pointer transition-all whitespace-nowrap px-4 ${bibleMode === 'protestant' ? 'bg-primary text-on-primary shadow-sm' : 'hover:bg-white/50'}`}
                    >
                      {t('protestant')}
                    </button>
                    <button 
                      onClick={() => setBibleMode('catholic')}
                      className={`flex-1 py-3 rounded-full cursor-pointer transition-all whitespace-nowrap px-4 ${bibleMode === 'catholic' ? 'bg-primary text-on-primary shadow-sm' : 'hover:bg-white/50'}`}
                    >
                      {t('catholic')}
                    </button>
                    <button 
                      onClick={() => setBibleMode('orthodox')}
                      className={`flex-1 py-3 rounded-full cursor-pointer transition-all whitespace-nowrap px-4 ${bibleMode === 'orthodox' ? 'bg-primary text-on-primary shadow-sm' : 'hover:bg-white/50'}`}
                    >
                      {t('orthodox')}
                    </button>
                  </div>
                </div>

                <h3 className="font-headline text-lg font-bold uppercase tracking-widest text-secondary">{t('interface_appearance')}</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                  {/* Theme Selection */}
                  <div className="space-y-4">
                    <label className="font-label font-bold text-sm text-primary">{t('theme_mode')}</label>
                    <div className="grid grid-cols-3 gap-3">
                      <button 
                        onClick={() => setThemeMode('light')}
                        className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${themeMode === 'light' ? 'border-primary bg-surface-container-lowest shadow-sm' : 'border-transparent bg-surface-container-low hover:bg-surface-container-high'}`}
                      >
                        <span className="material-symbols-outlined">light_mode</span>
                        <span className="font-label text-xs font-bold">{t('light')}</span>
                      </button>
                      <button 
                        onClick={() => setThemeMode('dark')}
                        className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${themeMode === 'dark' ? 'border-primary bg-surface-container-lowest shadow-sm' : 'border-transparent bg-surface-container-low hover:bg-surface-container-high'}`}
                      >
                        <span className="material-symbols-outlined">dark_mode</span>
                        <span className="font-label text-xs font-medium">{t('dark')}</span>
                      </button>
                      <button 
                        onClick={() => setThemeMode('system')}
                        className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${themeMode === 'system' ? 'border-primary bg-surface-container-lowest shadow-sm' : 'border-transparent bg-surface-container-low hover:bg-surface-container-high'}`}
                      >
                        <span className="material-symbols-outlined">settings_brightness</span>
                        <span className="font-label text-xs font-medium">{t('system')}</span>
                      </button>
                    </div>
                  </div>

                  {/* Color Presets */}
                  <div className="space-y-6">
                    <div className="space-y-4">
                      <label className="font-label font-bold text-sm text-primary">{t('accent_color')}</label>
                      <div className="flex flex-wrap gap-4">
                        {[
                          { name: 'color_gold', color: '#775a19' },
                          { name: 'color_emerald', color: '#00342b' },
                          { name: 'color_ruby', color: '#ba1a1a' },
                          { name: 'color_earth', color: '#4e2013' },
                          { name: 'color_black', color: '#000000' },
                          { name: 'color_white', color: '#ffffff' }
                        ].map((preset) => (
                          <button 
                            key={preset.color}
                            onClick={() => setAccentColor(preset.color)}
                            style={{ backgroundColor: preset.color }}
                            className={`w-12 h-12 rounded-full transition-all hover:scale-110 flex items-center justify-center ${accentColor === preset.color ? 'ring-offset-4 ring-2 ring-primary' : ''}`}
                            title={t(preset.name)}
                          >
                            {accentColor === preset.color && (
                              <span className="material-symbols-outlined text-sm" style={{ color: accentTextColor }}>check</span>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-4">
                      <label className="font-label font-bold text-sm text-primary">{t('accent_text_color')}</label>
                      <div className="flex flex-wrap gap-4">
                        {[
                          { name: 'color_white', color: '#ffffff' },
                          { name: 'color_black', color: '#000000' },
                          { name: 'color_gold', color: '#fed488' },
                          { name: 'color_emerald', color: '#bcece7' }
                        ].map((preset) => (
                          <button 
                            key={preset.color}
                            onClick={() => setAccentTextColor(preset.color)}
                            style={{ backgroundColor: preset.color }}
                            className={`w-10 h-10 rounded-full transition-all hover:scale-110 flex items-center justify-center border border-primary/10 ${accentTextColor === preset.color ? 'ring-offset-4 ring-2 ring-primary' : ''}`}
                            title={t(preset.name)}
                          >
                            {accentTextColor === preset.color && (
                              <span className="material-symbols-outlined text-sm" style={{ color: preset.color === '#ffffff' ? '#000000' : '#ffffff' }}>check</span>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Text Size Slider */}
                    <div className="flex justify-between items-center">
                      <label className="font-label font-bold text-sm text-primary">{t('language')}</label>
                      <div className="flex bg-surface-container-high p-1 rounded-full border border-primary/5">
                        {['system', 'pt_br', 'pt_pt', 'en', 'es', 'fr'].map((lang) => (
                          <button 
                            key={lang}
                            onClick={() => setAppLanguage(lang as AppLanguage)}
                            className={`px-3 py-1 rounded-full font-label text-[10px] font-bold uppercase tracking-widest transition-all ${appLanguage === lang ? 'bg-secondary text-on-secondary shadow-md' : 'text-on-surface/40 hover:text-primary'}`}
                          >
                            {lang === 'system' ? t('system') : lang.replace('_', '-').toUpperCase()}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-6">
                      <div className="flex justify-between items-center">
                        <label className="font-label font-bold text-sm text-primary">{t('font_size')}</label>
                        <span className="font-body italic text-secondary">{fontSize}px</span>
                      </div>
                    <div className="relative w-full h-8 flex items-center">
                      <input 
                        type="range" 
                        min="1" 
                        max="32" 
                        value={fontSize}
                        onChange={(e) => setFontSize(parseInt(e.target.value))}
                        className="w-full h-1 bg-surface-container-highest rounded-full appearance-none cursor-pointer accent-secondary"
                      />
                      <div className="w-full flex justify-between px-1 mt-10 pointer-events-none">
                        <span className="text-xs font-label opacity-50">A</span>
                        <span className="text-lg font-label opacity-50">A</span>
                      </div>
                    </div>
                  </div>

                  {/* Font Selection */}
                  <div className="space-y-4">
                    <label className="font-label font-bold text-sm text-primary">{t('font_family')}</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {[
                        { name: 'Newsreader', value: 'Newsreader', class: 'font-body' },
                        { name: 'Manrope', value: 'Manrope', class: 'font-headline' },
                        { name: 'Comfortaa', value: 'Comfortaa', class: 'font-comfortaa' },
                        { name: t('font_manuscript'), value: 'Manuscrito', class: 'font-manuscrito' },
                        { name: t('font_bold'), value: 'Negritos', class: 'font-negritos' },
                        { name: t('system'), value: 'System', class: 'font-system' }
                      ].map((font) => (
                        <button 
                          key={font.value}
                          onClick={() => setFontFamily(font.value)}
                          className={`p-4 rounded-xl flex justify-between items-center group transition-all ${fontFamily === font.value ? 'bg-surface-container-lowest border border-outline-variant/20 shadow-sm' : 'bg-surface-container-low hover:bg-surface-container-high'}`}
                        >
                          <span className={`${font.class} text-sm`}>{font.name}</span>
                          <span className={`material-symbols-outlined text-xs ${fontFamily === font.value ? 'text-secondary' : 'text-outline-variant'}`}>
                            {fontFamily === font.value ? 'radio_button_checked' : 'radio_button_unchecked'}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>


                <h3 className="font-headline text-lg font-bold uppercase tracking-widest text-secondary">{t('tts_settings')}</h3>
                <div className="bg-surface-container-high p-8 rounded-[2.5rem] space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-4">
                      <label className="font-label font-bold text-sm text-primary">{t('voice_speed')}</label>
                      <div className="flex items-center gap-4">
                        <input 
                          type="range" 
                          min="0.5" 
                          max="2" 
                          step="0.1"
                          value={speechRate}
                          onChange={(e) => setSpeechRate(parseFloat(e.target.value))}
                          className="flex-1 h-1 bg-surface-container-highest rounded-full appearance-none cursor-pointer accent-secondary"
                        />
                        <span className="font-body italic text-secondary w-12">{speechRate}x</span>
                      </div>
                    </div>
                    
                    <div className="space-y-4">
                      <label className="font-label font-bold text-sm text-primary">{t('device_voice')}</label>
                      <select 
                        value={selectedVoice}
                        onChange={(e) => setSelectedVoice(e.target.value)}
                        className="w-full p-3 rounded-xl bg-white border border-primary/10 font-label text-sm outline-none focus:ring-2 focus:ring-primary/20"
                      >
                        <option value="">{t('default_voice')}</option>
                        {availableVoices.map(voice => (
                          <option key={voice.name} value={voice.name}>{voice.name} ({voice.lang})</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <div className="pt-12 border-t border-primary/10 text-center">
                </div>
              </section>

              {/* Decorative Image Context */}
              <section className="mt-12 rounded-[3rem] overflow-hidden h-64 relative group shadow-xl">
                <Image 
                  alt="Library setting" 
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" 
                  src="https://picsum.photos/seed/library/1200/600"
                  fill
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-primary/80 to-transparent flex flex-col justify-end p-12">
                  <p className="font-body italic text-white text-2xl max-w-md">&quot;{t('lamp_verse')}&quot;</p>
                  <p className="font-label text-xs uppercase tracking-widest text-primary-fixed mt-4">{t('lamp_ref')}</p>
                </div>
              </section>
            </motion.div>
          )}

          {activeView === 'translations' && (
            <motion.div 
              key="translations"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-4xl mx-auto"
            >
              <div className="flex items-center gap-4 mb-8">
                <button onClick={() => setActiveView('library')} className="p-2 hover:bg-primary/5 rounded-full transition-colors">
                  <span className="material-symbols-outlined text-primary">arrow_back</span>
                </button>
              </div>
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-12">
                <div>
                  <h2 className="text-4xl font-headline font-bold text-primary">{t('translations')}</h2>
                  <p className="font-body text-lg text-on-surface-variant mt-2">{t('select_version_desc')}</p>
                </div>
                <div className="flex w-full sm:w-auto bg-surface-container-low p-2 rounded-full border border-primary/10 shadow-sm">
                  <input 
                    type="text"
                    placeholder={t('search_versions')}
                    value={versionSearchQuery}
                    onChange={(e) => setVersionSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearchVersions()}
                    className="bg-transparent px-4 py-2 outline-none font-label text-xs flex-1"
                  />
                  <button 
                    onClick={handleSearchVersions}
                    disabled={isSearchingVersions}
                    className="p-2 bg-primary text-on-primary rounded-full hover:bg-secondary transition-all disabled:opacity-50"
                  >
                    {isSearchingVersions ? (
                      <span className="material-symbols-outlined text-sm animate-spin">sync</span>
                    ) : (
                      <span className="material-symbols-outlined text-sm">search</span>
                    )}
                  </button>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {[...TRANSLATIONS, ...dynamicTranslations].map(version => (
                  <div 
                    key={version.id} 
                    className={`bg-surface-container-low p-8 rounded-[2.5rem] border transition-all cursor-pointer group ${selectedVersion.id === version.id ? 'border-primary shadow-md' : 'border-primary/10 shadow-sm hover:shadow-md'}`}
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div 
                        onClick={() => {
                          setSelectedVersion(version);
                          setActiveView('library');
                        }}
                        className="flex-1"
                      >
                        <h3 className="font-headline font-bold text-xl text-primary group-hover:text-secondary transition-colors">{version.name}</h3>
                        <span className="font-label text-xs text-on-surface/40 uppercase tracking-widest">{t('lang_' + version.language)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            downloadFullTranslation(version);
                          }}
                          disabled={isLoadingContent}
                          className="p-2 rounded-full bg-primary/5 text-primary hover:bg-primary/10 transition-all disabled:opacity-50 min-w-[40px] flex items-center justify-center"
                          title={t('download_full_translation')}
                        >
                          {isLoadingContent ? (
                            <span className="text-[10px] font-bold">{downloadProgress !== null ? `${downloadProgress}%` : <span className="material-symbols-outlined text-sm animate-spin">sync</span>}</span>
                          ) : (
                            <span className="material-symbols-outlined text-sm">download</span>
                          )}
                        </button>
                        <span className={`material-symbols-outlined text-secondary transition-opacity ${selectedVersion.id === version.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>check_circle</span>
                      </div>
                    </div>
                    <p className="font-body text-on-surface-variant">{t(version.description)}</p>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {activeView === 'original_languages' && (
            <motion.div 
              key="original_languages"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-4xl mx-auto"
            >
              <div className="flex items-center gap-4 mb-8">
                <button onClick={() => setActiveView('library')} className="p-2 hover:bg-primary/5 rounded-full transition-colors">
                  <span className="material-symbols-outlined text-primary">arrow_back</span>
                </button>
                <h2 className="text-4xl font-headline font-bold text-primary">{t('original_languages')}</h2>
              </div>
              <p className="font-body text-xl text-on-surface-variant mb-12">{t('original_languages_desc')}</p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {ORIGINAL_LANGUAGES.map(version => (
                  <div 
                    key={version.id} 
                    onClick={() => {
                      setSelectedVersion(version);
                      setActiveView('library');
                    }}
                    className={`bg-surface-container-low p-8 rounded-[2.5rem] border transition-all cursor-pointer group ${selectedVersion.id === version.id ? 'border-primary shadow-md' : 'border-primary/10 shadow-sm hover:shadow-md'}`}
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="font-headline font-bold text-xl text-primary group-hover:text-secondary transition-colors">{version.name}</h3>
                        <span className="font-label text-xs text-on-surface/40 uppercase tracking-widest">{t('lang_' + version.language)}</span>
                      </div>
                      <span className={`material-symbols-outlined text-secondary transition-opacity ${selectedVersion.id === version.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>auto_stories</span>
                    </div>
                    <p className="font-body text-on-surface-variant">{t(version.description)}</p>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Side Menu Drawer */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div 
            key="menu-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsMenuOpen(false)}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[80]"
          />
        )}
        {isMenuOpen && (
          <motion.div 
            key="menu-drawer"
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed top-0 left-0 bottom-0 w-80 bg-surface-container-high shadow-2xl z-[90] flex flex-col"
          >
              <div className="p-8 border-b border-primary/10">
                <div className="flex justify-between items-center mb-8">
                  <h2 className="text-2xl font-headline font-black text-primary">{t('menu')}</h2>
                  <button onClick={() => setIsMenuOpen(false)} className="text-on-surface/40 hover:text-primary transition-colors">
                    <span className="material-symbols-outlined">close</span>
                  </button>
                </div>
                <div className="space-y-2">
                  {[
                    { id: 'notifications', icon: 'notifications', label: t('notifications') },
                    { id: 'notes', icon: 'edit_note', label: t('notes') },
                    { id: 'favorites', icon: 'star', label: t('favorites') },
                    { id: 'offline_management', icon: 'cloud_download', label: t('stored_content') },
                    { id: 'share', icon: 'share', label: t('share_app'), action: shareApp },
                    { id: 'about', icon: 'info', label: t('about_dev') },
                    { id: 'feedback', icon: 'feedback', label: t('send_feedback') }
                  ].map(item => (
                    <button 
                      key={item.id}
                      onClick={() => {
                        if (item.action) {
                          item.action();
                        } else {
                          setActiveView(item.id as View);
                          setIsMenuOpen(false);
                        }
                      }}
                      className="w-full flex items-center gap-4 p-4 rounded-2xl hover:bg-primary/5 transition-all group"
                    >
                      <span className="material-symbols-outlined text-on-surface/40 group-hover:text-primary">{item.icon}</span>
                      <span className="font-label text-sm font-bold text-on-surface/70 group-hover:text-primary">{item.label}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="mt-auto p-8 opacity-20">
                <p className="text-[10px] font-label uppercase tracking-widest text-center">{t('version_label')} 1.0.4 - 2026</p>
              </div>
            </motion.div>
        )}
      </AnimatePresence>

      {/* Side Views (Notes, Favorites, etc) */}
      <AnimatePresence mode="wait">
        {activeView === 'notes' ? (
          <motion.div 
            key="notes"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="max-w-4xl mx-auto pt-24 pb-32 px-6"
          >
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-4xl font-headline font-bold text-primary">{t('notes_title')}</h2>
              <button 
                onClick={() => {
                  const newNote: Note = { id: Date.now().toString(), title: t('new_note'), content: '', createdAt: Date.now() };
                  setNotes([newNote, ...notes]);
                  setActiveNote(newNote);
                }}
                className="px-6 py-2 bg-primary text-on-primary rounded-full font-label text-xs font-bold uppercase tracking-widest"
              >
                {t('new_note')}
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="md:col-span-1 space-y-4 max-h-[60vh] overflow-y-auto custom-scrollbar pr-2">
                {notes.map(note => (
                  <button 
                    key={note.id}
                    onClick={() => setActiveNote(note)}
                    className={`w-full text-left p-6 rounded-[2rem] border transition-all ${activeNote?.id === note.id ? 'bg-primary text-on-primary border-primary shadow-lg' : 'bg-surface-container-low border-primary/10 hover:border-primary/30'}`}
                  >
                    <h4 className="font-headline font-bold mb-1 truncate">{note.title}</h4>
                    <p className={`text-xs font-body italic truncate ${activeNote?.id === note.id ? 'text-white/60' : 'text-on-surface/40'}`}>
                      {note.reference || t('no_reference')}
                    </p>
                  </button>
                ))}
              </div>
              <div className="md:col-span-2">
                {activeNote ? (
                  <div className="bg-surface-container-low p-8 rounded-[2.5rem] border border-primary/10 space-y-6">
                    <input 
                      value={activeNote.title}
                      onChange={(e) => {
                        const updated = { ...activeNote, title: e.target.value };
                        setActiveNote(updated);
                        setNotes(notes.map(n => n.id === activeNote.id ? updated : n));
                      }}
                      className="w-full bg-transparent text-2xl font-headline font-bold text-primary outline-none"
                      placeholder={t('note_title_placeholder')}
                    />
                    <textarea 
                      value={activeNote.content}
                      onChange={(e) => {
                        const updated = { ...activeNote, content: e.target.value };
                        setActiveNote(updated);
                        setNotes(notes.map(n => n.id === activeNote.id ? updated : n));
                      }}
                      className="w-full h-64 bg-transparent font-body text-lg leading-relaxed outline-none resize-none"
                      placeholder={t('note_content_placeholder')}
                    />
                    <div className="flex justify-between items-center pt-6 border-t border-primary/10">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-label uppercase tracking-widest text-on-surface/40">
                          {new Date(activeNote.createdAt).toLocaleDateString()}
                        </span>
                        {activeNote.reference && (
                          <span className="text-[10px] font-label font-bold text-secondary uppercase tracking-widest mt-1">
                            Ref: {activeNote.reference}
                          </span>
                        )}
                      </div>
                      <div className="flex gap-4">
                        <button 
                          onClick={() => {
                            setConfirmDialog({
                              message: t('confirm_delete_note'),
                              onConfirm: () => {
                                setNotes(notes.filter(n => n.id !== activeNote.id));
                                setActiveNote(null);
                                setConfirmDialog(null);
                                showToast(t('note_deleted'), 'success');
                              }
                            });
                          }}
                          className="text-destructive font-label text-[10px] uppercase font-bold tracking-widest hover:underline"
                        >
                          {t('delete')}
                        </button>
                        <button 
                          onClick={() => {
                            showToast(t('note_saved_auto'), 'success');
                          }}
                          className="text-primary font-label text-[10px] uppercase font-bold tracking-widest hover:underline"
                        >
                          {t('save')}
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-on-surface/20 italic">
                    <span className="material-symbols-outlined text-6xl mb-4">edit_note</span>
                    <p>{t('select_or_create_note')}</p>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        ) : activeView === 'favorites' ? (
          <motion.div 
            key="favorites"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="max-w-4xl mx-auto pt-24 pb-32 px-6"
          >
            <h2 className="text-4xl font-headline font-bold text-primary mb-12">{t('favorites_title')}</h2>
            <div className="space-y-12">
              {['#fef08a', '#bbf7d0', '#bfdbfe', '#fbcfe8', '#ddd6fe'].map(color => {
                const colorFavs = favorites.filter(f => f.color === color);
                if (colorFavs.length === 0) return null;
                return (
                  <div key={color} className="space-y-6">
                    <div className="flex items-center gap-4">
                      <div className="w-4 h-4 rounded-full" style={{ backgroundColor: color }}></div>
                      <h3 className="font-headline font-bold text-xl text-on-surface/60">{t('category')}</h3>
                    </div>
                    <div className="grid grid-cols-1 gap-6">
                      {colorFavs.map((fav, i) => (
                        <div key={i} className="p-8 bg-surface-container-low rounded-[2.5rem] border border-primary/10 relative group">
                          <div className="flex justify-between items-start mb-4">
                            <span className="font-label text-xs text-secondary font-bold uppercase tracking-widest">{fav.bookName} {fav.chapter}:{fav.verse}</span>
                            <button 
                              onClick={() => {
                                setConfirmDialog({
                                  message: t('confirm_remove_favorite'),
                                  onConfirm: () => {
                                    setFavorites(favorites.filter(f => f.id !== fav.id));
                                    setConfirmDialog(null);
                                    showToast(t('removed'), 'success');
                                  }
                                });
                              }}
                              className="text-on-surface/20 hover:text-destructive transition-colors"
                            >
                              <span className="material-symbols-outlined text-sm">delete</span>
                            </button>
                          </div>
                          <p className="text-xl font-body italic leading-relaxed">&quot;{fav.text}&quot;</p>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
              {favorites.length === 0 && (
                <div className="text-center py-32 text-on-surface/20 italic">
                  <span className="material-symbols-outlined text-6xl mb-4">star</span>
                  <p>{t('no_favorites')}</p>
                </div>
              )}
            </div>
          </motion.div>
        ) : activeView === 'offline_management' ? (
          <motion.div 
            key="offline_management"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="max-w-4xl mx-auto space-y-12 pt-24 pb-32 px-6"
          >
            <div className="text-center space-y-4">
              <h2 className="text-4xl font-headline font-bold text-primary">{t('stored_content')}</h2>
              <p className="font-body italic text-on-surface/60">{t('stored_content_desc')}</p>
            </div>

            <div className="bg-surface-container-high p-8 sm:p-12 rounded-[3rem] border border-primary/10 shadow-xl space-y-10">
              <div className="flex flex-col gap-8">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div className="space-y-1">
                    <p className="font-body text-xl text-on-surface font-bold">{t('offline_manager')}</p>
                    <p className="font-label text-xs text-on-surface-variant">{t('offline_manager_desc')}</p>
                  </div>
                  <button 
                    onClick={() => {
                      setConfirmDialog({
                        message: t('clear_cache'),
                        onConfirm: async () => {
                          await clearAllCache();
                          setCachedChapters([]);
                          setConfirmDialog(null);
                          showToast(t('cache_cleared'), 'success');
                        }
                      });
                    }}
                    className="px-8 py-3 rounded-full bg-red-500/10 text-red-600 font-label text-xs font-bold uppercase tracking-widest hover:bg-red-500/20 transition-all border border-red-500/20"
                  >
                    {t('clear_cache')}
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="p-8 bg-surface-container-low rounded-[2.5rem] border border-primary/5 space-y-6 flex flex-col justify-between">
                    <div className="space-y-2">
                      <p className="font-label text-sm font-bold text-primary uppercase tracking-widest">{t('current_book')}</p>
                      <p className="font-body text-sm text-on-surface-variant leading-relaxed">
                        {t('download_book_desc').replace('{book}', selectedBook ? t('book_' + selectedBook.id) : t('select_book'))}
                      </p>
                    </div>
                    <button 
                      onClick={downloadFullBook}
                      disabled={!selectedBook || isLoadingContent}
                      className="w-full flex items-center justify-center gap-3 px-8 py-4 rounded-2xl bg-secondary text-on-secondary font-label text-xs font-bold uppercase tracking-widest hover:shadow-lg transition-all disabled:opacity-50"
                    >
                      {isLoadingContent ? (
                        <span className="material-symbols-outlined text-xl animate-spin">sync</span>
                      ) : (
                        <span className="material-symbols-outlined text-xl">book</span>
                      )}
                      {isLoadingContent ? (downloadProgress !== null ? `${downloadProgress}%` : t('downloading')) : t('download_book')}
                    </button>
                  </div>

                  <div className="p-8 bg-surface-container-low rounded-[2.5rem] border border-primary/5 space-y-6 flex flex-col justify-between">
                    <div className="space-y-2">
                      <p className="font-label text-sm font-bold text-primary uppercase tracking-widest">{t('full_translation')}</p>
                      <p className="font-body text-sm text-on-surface-variant leading-relaxed">
                        {t('download_translation_desc').replace('{version}', selectedVersion.name)}
                      </p>
                    </div>
                    <button 
                      onClick={() => downloadFullTranslation(selectedVersion)}
                      disabled={isLoadingContent}
                      className="w-full flex items-center justify-center gap-3 px-8 py-4 rounded-2xl bg-primary text-on-primary font-label text-xs font-bold uppercase tracking-widest hover:shadow-lg transition-all disabled:opacity-50"
                    >
                      {isLoadingContent ? (
                        <span className="material-symbols-outlined text-xl animate-spin">sync</span>
                      ) : (
                        <span className="material-symbols-outlined text-xl">language</span>
                      )}
                      {isLoadingContent ? t('downloading') : t('download_all')}
                    </button>
                  </div>
                </div>
              </div>

              <div className="space-y-4 pt-8 border-t border-primary/10">
                <div className="flex justify-between items-center">
                  <p className="font-label text-xs uppercase tracking-widest text-secondary font-bold">
                    {t('downloaded_chapters').replace('{count}', cachedChapters.length.toString())}
                  </p>
                </div>
                <div className="max-h-64 overflow-y-auto custom-scrollbar space-y-3 pr-4">
                  {cachedChapters.length === 0 ? (
                    <div className="text-center py-12 bg-primary/5 rounded-3xl border border-dashed border-primary/20">
                      <p className="font-body text-sm italic text-on-surface-variant/50">{t('no_chapters_saved')}</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {cachedChapters.map(id => (
                        <div key={id} className="flex justify-between items-center p-4 bg-surface-container-lowest rounded-2xl border border-primary/5 group hover:border-primary/20 transition-all">
                          <span className="font-label text-xs font-medium text-on-surface/70">{id.replace(/-/g, ' ')}</span>
                          <button 
                            onClick={async () => {
                              await deleteCachedChapter(id);
                              setCachedChapters(prev => prev.filter(c => c !== id));
                            }}
                            className="w-8 h-8 flex items-center justify-center text-on-surface/20 hover:text-red-500 transition-colors"
                          >
                            <span className="material-symbols-outlined text-lg">delete</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        ) : activeView === 'about' ? (
          <motion.div 
            key="about"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="max-w-2xl mx-auto text-center space-y-12 pt-24 pb-32 px-6"
          >
            <div className="relative w-40 h-40 mx-auto">
              <div className="absolute inset-0 bg-primary/20 rounded-full animate-pulse"></div>
              <div className="relative w-full h-full rounded-full border-4 border-primary overflow-hidden shadow-2xl">
                <Image 
                  src="https://lh3.googleusercontent.com/a/default-user=s288-c-no" 
                  alt={t('dev_name')}
                  fill
                  className="object-cover"
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(t('dev_name'))}&background=00342b&color=fff&size=256`;
                  }}
                />
              </div>
            </div>
            <div className="space-y-4">
              <h2 className="text-4xl font-headline font-black text-primary">{t('dev_name')}</h2>
              <p className="font-label text-xs font-bold uppercase tracking-[0.4em] text-secondary">{t('dev_title')}</p>
            </div>
            <p className="text-xl font-body italic leading-relaxed text-on-surface/70">
              {t('dev_bio')}
            </p>
            <div className="pt-12 border-t border-primary/10 flex flex-col items-center gap-8">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 w-full max-w-lg">
                <a 
                  href={`mailto:${t('dev_email')}`}
                  className="flex flex-col items-center gap-3 p-6 bg-surface-container-low rounded-3xl border border-primary/5 hover:bg-primary/5 transition-all group"
                >
                  <span className="material-symbols-outlined text-3xl text-primary group-hover:scale-110 transition-transform">mail</span>
                  <span className="font-label text-[10px] font-bold uppercase tracking-widest text-on-surface/60">Email</span>
                </a>
                <a 
                  href={t('dev_whatsapp_url')}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex flex-col items-center gap-3 p-6 bg-surface-container-low rounded-3xl border border-primary/5 hover:bg-primary/5 transition-all group"
                >
                  <svg className="w-8 h-8 text-primary group-hover:scale-110 transition-transform" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.653a11.883 11.883 0 005.685 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                  <span className="font-label text-[10px] font-bold uppercase tracking-widest text-on-surface/60">WhatsApp</span>
                  <span className="text-[10px] font-body text-on-surface/40">{t('dev_whatsapp')}</span>
                </a>
                <a 
                  href={t('dev_facebook_url')}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex flex-col items-center gap-3 p-6 bg-surface-container-low rounded-3xl border border-primary/5 hover:bg-primary/5 transition-all group"
                >
                  <svg className="w-8 h-8 text-primary group-hover:scale-110 transition-transform" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                  </svg>
                  <span className="font-label text-[10px] font-bold uppercase tracking-widest text-on-surface/60">Facebook</span>
                  <span className="text-[10px] font-body text-on-surface/40">{t('dev_facebook')}</span>
                </a>
              </div>
            </div>
          </motion.div>
        ) : activeView === 'notifications' ? (
          <motion.div 
            key="notifications"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="max-w-2xl mx-auto space-y-12 pt-24 pb-32 px-6"
          >
            <div className="text-center space-y-4">
              <h2 className="text-4xl font-headline font-bold text-primary">{t('notifications')}</h2>
              <p className="font-body italic text-on-surface/60">{t('notifications_subtitle')}</p>
            </div>
            
            <div className="bg-surface-container-low p-10 rounded-[3rem] border border-primary/10 shadow-xl space-y-10">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="font-body text-xl text-on-surface font-bold">{t('enable_notifications')}</p>
                  <p className="font-label text-xs text-on-surface-variant">{t('enable_notifications_desc')}</p>
                </div>
                <button 
                  onClick={() => {
                    if (!notificationsEnabled) {
                      requestNotificationPermission();
                    } else {
                      setNotificationsEnabled(false);
                    }
                  }}
                  className={`w-14 h-8 rounded-full transition-all relative ${notificationsEnabled ? 'bg-primary' : 'bg-surface-container-highest'}`}
                >
                  <motion.div 
                    animate={{ x: notificationsEnabled ? 24 : 4 }}
                    className="absolute top-1 w-6 h-6 bg-white rounded-full shadow-sm"
                  />
                </button>
              </div>

              <div className={`flex items-center justify-between transition-opacity ${notificationsEnabled ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                <div className="space-y-1">
                  <p className="font-body text-xl text-on-surface font-bold">{t('fluent_widget')}</p>
                  <p className="font-label text-xs text-on-surface-variant">{t('fluent_widget_desc')}</p>
                </div>
                <button 
                  onClick={() => setWidgetEnabled(!widgetEnabled)}
                  className={`w-14 h-8 rounded-full transition-all relative ${widgetEnabled ? 'bg-secondary' : 'bg-surface-container-highest'}`}
                >
                  <motion.div 
                    animate={{ x: widgetEnabled ? 24 : 4 }}
                    className="absolute top-1 w-6 h-6 bg-white rounded-full shadow-sm"
                  />
                </button>
              </div>

              <div className={`flex items-center justify-between transition-opacity ${notificationsEnabled ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                <div className="space-y-1">
                  <p className="font-body text-xl text-on-surface font-bold">{t('daily_reminder')}</p>
                  <p className="font-label text-xs text-on-surface-variant">{t('daily_reminder_desc')}</p>
                </div>
                <button 
                  onClick={() => setDailyReminderEnabled(!dailyReminderEnabled)}
                  className={`w-14 h-8 rounded-full transition-all relative ${dailyReminderEnabled ? 'bg-primary' : 'bg-surface-container-highest'}`}
                >
                  <motion.div 
                    animate={{ x: dailyReminderEnabled ? 24 : 4 }}
                    className="absolute top-1 w-6 h-6 bg-white rounded-full shadow-sm"
                  />
                </button>
              </div>

              {dailyReminderEnabled && (
                <div className="flex items-center justify-between p-4 bg-surface-container-highest rounded-2xl">
                  <p className="font-label text-xs font-bold text-on-surface-variant uppercase">{t('reminder_time')}</p>
                  <input 
                    type="time" 
                    value={dailyReminderTime}
                    onChange={(e) => setDailyReminderTime(e.target.value)}
                    className="bg-transparent border-none font-headline font-bold text-primary outline-none"
                  />
                </div>
              )}

              {notificationsEnabled && (
                <div className="space-y-4">
                  <div className="p-6 bg-primary/5 rounded-2xl border border-primary/10">
                    <p className="text-sm font-body italic text-primary text-center">
                      &quot;{t('notifications_active_msg')}&quot;
                    </p>
                  </div>
                  <button 
                    onClick={() => {
                      const lang = getActiveLang();
                      const verses = DAILY_VERSES_BY_LANG[lang] || DAILY_VERSES_BY_LANG['pt_br'];
                      const randomVerse = verses[Math.floor(Math.random() * verses.length)];
                      new Notification(t('notification_test'), {
                        body: `"${randomVerse.text}" - ${randomVerse.reference}`,
                        icon: '/icon.svg',
                        badge: '/icon.svg'
                      });
                    }}
                    className="w-full py-3 bg-secondary/10 text-secondary rounded-2xl font-label text-xs font-bold uppercase tracking-widest hover:bg-secondary/20 transition-all"
                  >
                    {t('test_notification_now')}
                  </button>
                </div>
              )}
            </div>

            <div className="text-center">
              <button 
                onClick={() => setActiveView('library')}
                className="text-primary font-label text-xs font-bold uppercase tracking-widest hover:underline"
              >
                {t('back_to_library')}
              </button>
            </div>
          </motion.div>
        ) : activeView === 'canon_history' ? (
          <motion.div 
            key="canon_history"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="max-w-4xl mx-auto pt-24 pb-32 px-6"
          >
            <div className="flex items-center justify-between mb-12">
              <div className="flex items-center gap-4">
                <button onClick={() => setActiveView('library')} className="p-2 hover:bg-primary/5 rounded-full transition-colors">
                  <span className="material-symbols-outlined text-primary">arrow_back</span>
                </button>
                <h2 className="text-4xl font-headline font-bold text-primary">{t('canon_history_title')}</h2>
              </div>
              
              <div className="flex items-center gap-2 bg-surface-container-high p-1 rounded-full border border-primary/10">
                {(['all', 'protestant', 'catholic', 'orthodox', 'historical'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setCanonHistoryTab(tab)}
                    className={`px-4 py-1.5 rounded-full font-label text-[10px] font-bold uppercase tracking-widest transition-all ${canonHistoryTab === tab ? 'bg-primary text-on-primary shadow-md' : 'text-on-surface/40 hover:bg-surface-container-low'}`}
                  >
                    {tab === 'all' ? t('all') : tab === 'historical' ? t('apocrypha_history') : t(tab)}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {Object.entries(CANON_HISTORY[getActiveLang()] || CANON_HISTORY['pt_br'])
                .filter(([key]) => canonHistoryTab === 'all' || key === canonHistoryTab)
                .map(([key, history]) => (
                <div key={key} className="bg-surface-container-low p-10 rounded-[3rem] border border-primary/10 shadow-xl space-y-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                      <span className="material-symbols-outlined">history_edu</span>
                    </div>
                    <h3 className="font-headline font-bold text-2xl text-primary">{history.title}</h3>
                  </div>
                  <p className="font-body text-lg leading-relaxed text-on-surface/70 italic">
                    {history.content}
                  </p>
                </div>
              ))}
            </div>
          </motion.div>
        ) : activeView === 'feedback' ? (
          <motion.div 
            key="feedback"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="max-w-2xl mx-auto space-y-12 pt-24 pb-32 px-6"
          >
            <div className="text-center space-y-4">
              <h2 className="text-4xl font-headline font-bold text-primary">{t('feedback_title')}</h2>
              <p className="font-body italic text-on-surface/60">{t('feedback_subtitle')}</p>
            </div>
            <div className="bg-surface-container-low p-10 rounded-[3rem] border border-primary/10 shadow-xl space-y-8">
              <textarea 
                value={feedbackMessage}
                onChange={(e) => setFeedbackMessage(e.target.value)}
                className="w-full h-48 bg-transparent text-xl font-body outline-none resize-none"
                placeholder={t('feedback_placeholder')}
              />
              <button 
                onClick={sendFeedback}
                className="w-full py-6 bg-primary text-on-primary rounded-full font-label text-sm font-bold uppercase tracking-widest shadow-lg hover:bg-secondary transition-all active:scale-95"
              >
                {t('send_message')}
              </button>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {isBibliologyOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-sm"
            onClick={() => setIsBibliologyOpen(false)}
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-surface-container-low w-full max-w-2xl max-h-[80vh] rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden border border-primary/10"
              onClick={e => e.stopPropagation()}
            >
              <div className="p-6 sm:p-8 border-b border-primary/5 flex justify-between items-center bg-primary/5">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                    <span className="material-symbols-outlined text-2xl">history_edu</span>
                  </div>
                  <div>
                    <h3 className="font-headline font-bold text-xl text-primary leading-none">
                      {selectedBook ? t('bibliology_title', t('book_' + selectedBook.id)) : t('bibliology_btn')}
                    </h3>
                    <p className="font-label text-[10px] uppercase tracking-widest text-secondary/60 mt-1">Estudo Introdutório</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsBibliologyOpen(false)}
                  className="w-10 h-10 rounded-full hover:bg-primary/10 flex items-center justify-center text-primary transition-colors"
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 sm:p-8 custom-scrollbar">
                {isLoadingBibliology ? (
                  <div className="flex flex-col items-center justify-center py-12 gap-4">
                    <span className="material-symbols-outlined text-4xl text-primary animate-spin">sync</span>
                    <p className="font-label text-xs uppercase tracking-widest text-secondary/60 animate-pulse">{t('bibliology_loading')}</p>
                  </div>
                ) : bibliologyContent ? (
                  <div className="prose prose-sm sm:prose-base prose-primary max-w-none dark:prose-invert">
                    <div className="markdown-body">
                      <ReactMarkdown>{bibliologyContent}</ReactMarkdown>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <p className="text-on-surface/60 italic">{t('bibliology_error')}</p>
                  </div>
                )}
              </div>
              
              <div className="p-6 bg-primary/5 border-t border-primary/5 flex justify-end">
                <button 
                  onClick={() => setIsBibliologyOpen(false)}
                  className="px-6 py-3 rounded-xl bg-primary text-on-primary font-label text-xs font-bold uppercase tracking-widest hover:shadow-lg transition-all"
                >
                  {t('close')}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {isFetchingLexicon ? (
          <motion.div 
            key="lexicon-loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[65] flex items-center justify-center"
          >
            <div className="bg-white p-8 rounded-[2rem] flex flex-col items-center gap-4 shadow-2xl">
              <motion.div 
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                className="w-10 h-10 border-4 border-primary/10 border-t-primary rounded-full"
              />
              <p className="font-body italic text-primary">{t('consulting_lexicons')}</p>
            </div>
          </motion.div>
        ) : lexiconData ? (
          <LexiconCard 
            key="lexicon-card"
            data={lexiconData}
            onClose={() => setLexiconData(null)}
            t={t}
          />
        ) : null}
      </AnimatePresence>

      {/* Bottom Navigation Bar */}
      <nav className="fixed bottom-0 left-0 w-full z-50 flex justify-around items-center px-4 pb-4 pt-1 bg-background/90 backdrop-blur-2xl border-t border-primary/10 rounded-t-[2rem] shadow-[0_-4px_24px_rgba(0,0,0,0.04)]">
        <button 
          onClick={() => setActiveView('library')}
          className={`flex flex-col items-center py-1.5 px-4 rounded-2xl transition-all ${activeView === 'library' ? 'bg-primary text-on-primary shadow-lg' : 'text-on-surface/40 hover:text-primary'}`}
        >
          <span className="material-symbols-outlined">library_books</span>
          <span className="text-[9px] font-bold uppercase mt-1">{t('books')}</span>
        </button>
        <button 
          onClick={() => setActiveView('read')}
          className={`flex flex-col items-center py-1.5 px-4 rounded-2xl transition-all ${activeView === 'read' ? 'bg-primary text-on-primary shadow-lg' : 'text-on-surface/40 hover:text-primary'}`}
        >
          <span className="material-symbols-outlined">menu_book</span>
          <span className="text-[9px] font-bold uppercase mt-1">{t('reading')}</span>
        </button>
        <button 
          onClick={() => setActiveView('search')}
          className={`flex flex-col items-center py-1.5 px-4 rounded-2xl transition-all ${activeView === 'search' ? 'bg-primary text-on-primary shadow-lg' : 'text-on-surface/40 hover:text-primary'}`}
        >
          <span className="material-symbols-outlined">search</span>
          <span className="text-[9px] font-bold uppercase mt-1">{t('search')}</span>
        </button>
        <button 
          onClick={() => setActiveView('settings')}
          className={`flex flex-col items-center py-1.5 px-4 rounded-2xl transition-all ${activeView === 'settings' ? 'bg-primary text-on-primary shadow-lg' : 'text-on-surface/40 hover:text-primary'}`}
        >
          <span className="material-symbols-outlined">settings</span>
          <span className="text-[10px] font-bold uppercase mt-1">{t('settings')}</span>
        </button>
      </nav>

      {/* Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div 
            key="toast"
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="fixed bottom-32 left-1/2 -translate-x-1/2 z-[100] px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 min-w-[300px]"
            style={{ 
              backgroundColor: toast.type === 'error' ? '#fee2e2' : toast.type === 'success' ? '#dcfce7' : '#f3f4f6',
              color: toast.type === 'error' ? '#991b1b' : toast.type === 'success' ? '#166534' : '#1f2937',
              border: `1px solid ${toast.type === 'error' ? '#fecaca' : toast.type === 'success' ? '#bbf7d0' : '#e5e7eb'}`
            }}
          >
            <span className="material-symbols-outlined text-xl">
              {toast.type === 'error' ? 'error' : toast.type === 'success' ? 'check_circle' : 'info'}
            </span>
            <span className="font-body text-sm font-medium">{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Confirm Dialog */}
      <AnimatePresence>
        {confirmDialog && (
          <motion.div 
            key="confirm-dialog"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[110] flex items-center justify-center p-6"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-[2.5rem] p-10 max-w-md w-full shadow-2xl space-y-8"
            >
              <div className="space-y-4">
                <h3 className="text-2xl font-headline font-bold text-primary">{t('confirm_action')}</h3>
                <p className="font-body text-on-surface/70 leading-relaxed">{confirmDialog.message}</p>
              </div>
              <div className="flex gap-4">
                <button 
                  onClick={() => setConfirmDialog(null)}
                  className="flex-1 py-4 rounded-full font-label text-xs font-bold uppercase tracking-widest text-on-surface/40 hover:bg-surface-container-low transition-all"
                >
                  {t('cancel')}
                </button>
                <button 
                  onClick={confirmDialog.onConfirm}
                  className="flex-1 py-4 bg-primary text-on-primary rounded-full font-label text-xs font-bold uppercase tracking-widest shadow-lg hover:bg-secondary transition-all"
                >
                  {t('confirm')}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Texture Overlay */}
      <div className="fixed inset-0 pointer-events-none opacity-[0.02] mix-blend-multiply bg-repeat z-[-1]" style={{ backgroundImage: "url('https://lh3.googleusercontent.com/aida-public/AB6AXuADjza4Ag0tAxPjIAJeEjL0696UDIkfnHckwZcKVYNrh5TmXU2DCFNOZLHjAkkpi4GSzpvjYKBvMRWyUm4ubiTrUTzUp9t17-TlH9HkaPtIbfD1DbDx7b5uVK_LJWn6rhvta-q8-FSUEKTxhVq8TeR-WAL7j72xZxDfU4n_Gk9M-ECULC4ECOkidJlTs_gKkXVdiMl6aYEaAPqfqrcKo_VOm3wfpL_nKDw9brthy1WvzKBWEe4D_n9fb_MQ1d9XH7ttDK2CgOaCRiHQ')" }}></div>
    </div>
  );
}
