'use client';
import {useState} from 'react';
import type {Flashcard} from '@/lib/services/flashcards';

export function FlashcardDeck({cards}:{cards:Flashcard[]}){
 const[order,setOrder]=useState(cards.map((_,i)=>i));const[pos,setPos]=useState(0);const[flipped,setFlipped]=useState(false);const[known,setKnown]=useState(0);
 const card=cards[order[pos]];
 if(!card)return <p className="app-sub">That is every card in this deck.</p>;
 const done=pos>=order.length;
 const go=(gotIt:boolean)=>{if(gotIt)setKnown(k=>k+1);setFlipped(false);setPos(pos+1);};
 if(done)return <div className="panel"><h2>Deck finished</h2><p>You knew {known} of {order.length}.</p><button type="button" className="practice-button" onClick={()=>{setOrder([...order].sort(()=>Math.random()-.5));setPos(0);setKnown(0);}}>Shuffle and go again</button></div>;
 return <div className="panel flashcard">
  <p className="app-sub">Card {pos+1} of {order.length} · {card.source}</p>
  <button type="button" className="flashcard-face" aria-live="polite" onClick={()=>setFlipped(!flipped)}>
   <small>{flipped?'Answer':'Prompt'} · tap to flip</small><span>{flipped?card.back:card.front}</span>
  </button>
  {flipped&&<div className="flashcard-actions"><button type="button" className="practice-ghost" onClick={()=>go(false)}>Review again</button><button type="button" className="practice-button" onClick={()=>go(true)}>I knew it</button></div>}
 </div>;
}
