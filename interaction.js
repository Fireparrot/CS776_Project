'use strict';

window.onload = function() {
	google.charts.load('current', {'packages':['timeline', 'corechart', 'line']});
	addEventListeners();
    webpage_setup();
	google.charts.setOnLoadCallback(func_selection);
};

function addEventListeners () {
	document.getElementById('func_selector').addEventListener('change', func_selection);
	document.getElementById('init_mean').addEventListener('focusout', set_init_mean);
	document.getElementById('init_radius').addEventListener('focusout', set_init_radius);
	document.getElementById('pop_size').addEventListener('focusout', set_pop_size);
	document.getElementById('cross_prob').addEventListener('focusout', set_cross_prob);
	document.getElementById('sbx_n').addEventListener('focusout', set_sbx_n);
	document.getElementById('amount_runs').addEventListener('focusout', set_amount_runs);
	document.getElementById('generate_init').addEventListener('click', generate_init_generation);
	document.getElementById('next_gen').addEventListener('click', do_next_gen);
	document.getElementById('all_gens').addEventListener('click', do_all_gens);
	document.getElementById('many_runs').addEventListener('click', do_many_runs);
	document.getElementById('clear_stats').addEventListener('click', clear_stats);
}
