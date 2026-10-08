export function createBgmSystem(ctx) {
  const master=ctx.createGain();master.gain.value=.6;master.connect(ctx.destination);
  const pad=ctx.createGain();pad.gain.value=0;pad.connect(master);
  const tension=ctx.createGain();tension.gain.value=0;tension.connect(master);
  const chords=[[48,52,55],[43,47,50],[45,48,52],[41,45,48]];
  let active=false,chordIndex=0,voices=[];
  function schedulePad(time,chord,duration){
    for(const midi of chord){
      const osc=ctx.createOscillator(),gain=ctx.createGain();
      osc.type='sine';osc.frequency.setValueAtTime(440*Math.pow(2,(midi-69)/12),time);
      gain.gain.setValueAtTime(0,time);gain.gain.linearRampToValueAtTime(.15,time+duration*.2);
      gain.gain.setValueAtTime(.15,time+duration*.8);gain.gain.linearRampToValueAtTime(0,time+duration);
      osc.connect(gain);gain.connect(pad);osc.start(time);osc.stop(time+duration);voices.push(osc);
    }
  }
  function scheduleTension(time,duration){
    const osc=ctx.createOscillator(),gain=ctx.createGain();osc.type='sawtooth';
    osc.frequency.setValueAtTime(55,time);osc.frequency.linearRampToValueAtTime(60,time+duration);
    gain.gain.setValueAtTime(0,time);gain.gain.linearRampToValueAtTime(.1,time+.1);gain.gain.linearRampToValueAtTime(0,time+duration);
    osc.connect(gain);gain.connect(tension);osc.start(time);osc.stop(time+duration);voices.push(osc);
  }
  return {
    start(){if(active)return;active=true;chordIndex=0;pad.gain.setValueAtTime(.34,ctx.currentTime);tension.gain.setValueAtTime(.05,ctx.currentTime);},
    stop(){active=false;for(const osc of voices){try{osc.stop();}catch{}}voices=[];},
    setGain(value){master.gain.setTargetAtTime(value,ctx.currentTime,.1);},
    tick(index,until,lowHp){
      if(!active)return;
      if(pad.gain.value<.01)pad.gain.setTargetAtTime(.42,ctx.currentTime,.5);
      const time=ctx.currentTime+until()/1000,duration=until()*4/1000;
      if(index%16===0){chordIndex=(chordIndex+1)%chords.length;schedulePad(time,chords[chordIndex],duration*4);}
      if(index%8===0){tension.gain.setTargetAtTime(lowHp?.6:.08,ctx.currentTime,2);scheduleTension(time,duration*2);}
      if(index%64===0)voices=voices.slice(-50);
    }
  };
}
