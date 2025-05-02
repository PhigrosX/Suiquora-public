//14days of answer duration, bounty, undeletable questions and answers
module suiquora::suiquora;

use sui::clock::{Self, Clock};
use sui::coin::{Self, Coin};
use sui::dynamic_object_field as dof;
use sui::event;
use sui::sui::SUI;

//you can answer other address' answer
public struct AnswerComment has key, store {
    id: UID,
    answerer: address,
    answer_content: vector<u8>,
    images: Option<vector<vector<u8>>>,
    time: u64,
}

public struct Answer has key, store {
    id: UID,
    answerer: address,
    answer_content: vector<u8>,
    images: Option<vector<vector<u8>>>,
    time: u64,
    //extra
    extra_answerers: vector<address>,
    extra_content: vector<AnswerComment>,
}

public struct Question has key, store {
    id: UID,
    asker: address,
    content: vector<u8>,
    images: Option<vector<vector<u8>>>,
    answerers: vector<address>,
    answers: vector<Answer>,
    bounty_amount: u64,
    answered: bool,
    best_answer: Option<Answer>,
    create_time: u64,
    end_time: u64,
}

public struct QuestionsInformation has key, store {
    id: UID,
    askers: vector<address>,
    question_information: vector<vector<ID>>,
    answerers: vector<address>,
    answers_information: vector<vector<ID>>,
    commenters: vector<address>,
    comment_to_questions: vector<vector<ID>>,
    comment_to_answers: vector<vector<ID>>,
}

//events
public struct QuestionCreatedEvent has copy, drop {
    question_id: ID,
    asker: address,
    bounty: u64,
}
public struct QuestionAnsweredEvent has copy, drop {
    question_id: ID,
    answerer: address,
    bounty: u64,
}
public struct AnswerUpdated has copy, drop {
    question_id: ID,
    asker: address,
    answerer: address,
    bounty: u64,
}
public struct QuestionSolvedEvent has copy, drop {
    question_id: ID,
    asker: address,
    best_answerer: address,
    bounty: u64,
}
public struct QuestionExpired has copy, drop {
    question_id: ID,
    asker: address,
    bounty: u64,
}
public struct CommentAdded has copy, drop {
    question_id: ID,
    asker: address,
    //the answerer to the question
    answerer: address,
    //the comment address to the answer
    commenter: address,
    bounty: u64,
}
public struct CommentUpdated has copy, drop {
    question_id: ID,
    asker: address,
    answerer: address,
    commenter: address,
    bounty: u64,
}

//consts
const Bounty: vector<u8> = b"coin";

//errors
const EHaveExpired: u64 = 0;
const EHaveBeenSolved: u64 = 1;
const EHaveAnsweredBefore: u64 = 2;
const EHaveNotAnsweredBefore: u64 = 3;
const ENoOneAnswered: u64 = 4;
const ENotYourQuestion: u64 = 5;
const ENotValidAnswerer: u64 = 6;
const ENotExpired: u64 = 7;

fun init(ctx: &mut TxContext) {
    //create a QuestionsInformation struct and make it a shared object
    let question_information = QuestionsInformation {
        id: object::new(ctx),
        question_information: vector::empty<vector<ID>>(),
        answers_information: vector::empty<vector<ID>>(),
        askers: vector::empty<address>(),
        answerers: vector::empty<address>(),
        commenters: vector::empty<address>(),
        comment_to_answers: vector::empty<vector<ID>>(),
        comment_to_questions: vector::empty<vector<ID>>(),
    };
    transfer::public_share_object(question_information);
}

//ask a question
#[allow(lint(self_transfer))]
public fun ask_question(
    content: vector<u8>,
    bounty_amount: u64,
    mut coin: Coin<SUI>,
    clock: &Clock,
    images: Option<vector<vector<u8>>>,
    question_information: &mut QuestionsInformation,
    duration: u64,
    ctx: &mut TxContext,
) {
    //split coins
    let _coin = coin::split(&mut coin, bounty_amount, ctx);
    let mut question = Question {
        id: object::new(ctx),
        asker: tx_context::sender(ctx),
        answers: vector::empty(),
        answerers: vector::empty(),
        content,
        images,
        //bounty,
        bounty_amount,
        answered: false,
        best_answer: option::none(),
        create_time: clock::timestamp_ms(clock),
        end_time: clock::timestamp_ms(clock) + duration,
    };
    dof::add(&mut question.id, Bounty, _coin);

    if (!question_information.askers.contains(&tx_context::sender(ctx))) {
        question_information.askers.push_back(tx_context::sender(ctx));
        question_information.question_information.push_back(vector::empty());
    };

    let (_, _index) = question_information.askers.index_of(&tx_context::sender(ctx));
    let question_id = question.id.to_address().to_id();
    question_information.question_information[_index].push_back(question_id);

    transfer::share_object(question);
    transfer::public_transfer(coin, tx_context::sender(ctx));

    event::emit(QuestionCreatedEvent {
        question_id: question_id,
        asker: tx_context::sender(ctx),
        bounty: bounty_amount,
    });
}

//choose the best answer
#[allow(lint(self_transfer))]
public fun choose_answer(
    question: &mut Question,
    answerer: address,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    //make sure is the asker of the question
    assert!(question.asker == tx_context::sender(ctx), ENotYourQuestion);
    //make sure not expired
    assert!(question.end_time >= clock::timestamp_ms(clock), EHaveExpired);
    //make sure have not choosed the best answer
    assert!(question.answered == false, EHaveBeenSolved);
    //make sure some already answered
    assert!(!question.answerers.is_empty(), ENoOneAnswered);

    //get the best answer via address
    let (_, _index) = question.answerers.index_of(&answerer);
    let best_answer = question.answers.remove(_index);
    option::fill(&mut question.best_answer, best_answer);
    question.answered = true;

    //then transfer the coin to the answer address
    let _coin = dof::remove<vector<u8>, Coin<SUI>>(&mut question.id, Bounty);
    transfer::public_transfer(_coin, answerer);

    event::emit(QuestionSolvedEvent {
        question_id: question.id.to_address().to_id(),
        asker: question.asker,
        best_answerer: answerer,
        bounty: question.bounty_amount,
    });
}

//answer question,
public fun answer_question(
    question: &mut Question,
    answer_content: vector<u8>,
    images: Option<vector<vector<u8>>>,
    question_information: &mut QuestionsInformation,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    //make sure can't answer own question
    assert!(question.asker != tx_context::sender(ctx), ENotValidAnswerer);
    //make sure haven't answered before
    assert!(!vector::contains(&question.answerers, &tx_context::sender(ctx)), EHaveAnsweredBefore);
    //make sure haven't expired
    assert!(question.end_time >= clock::timestamp_ms(clock), EHaveExpired);

    //create a answer and store in question struct
    let answer = Answer {
        id: object::new(ctx),
        answerer: tx_context::sender(ctx),
        answer_content,
        images,
        time: clock.timestamp_ms(),
        extra_answerers: vector::empty(),
        extra_content: vector::empty(),
    };

    if (!question_information.answerers.contains(&tx_context::sender(ctx))) {
        question_information.answerers.push_back(tx_context::sender(ctx));
        question_information.answers_information.push_back(vector::empty());
    };
    let (_, _index) = question_information.answerers.index_of(&tx_context::sender(ctx));
    question_information.answers_information[_index].push_back(answer.id.to_address().to_id());
    vector::push_back(&mut question.answerers, tx_context::sender(ctx));
    vector::push_back(&mut question.answers, answer);

    event::emit(QuestionAnsweredEvent {
        question_id: question.id.to_address().to_id(),
        answerer: tx_context::sender(ctx),
        bounty: question.bounty_amount,
    });
}

public fun update_answer(
    question: &mut Question,
    new_content: vector<u8>,
    new_images: Option<vector<vector<u8>>>,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    // make sure haven't expired
    assert!(question.end_time >= clock::timestamp_ms(clock), EHaveExpired);
    // make sure haven't solved
    assert!(!question.answered, EHaveBeenSolved);

    // make sure have answered before
    assert!(question.answerers.contains(&tx_context::sender(ctx)), EHaveNotAnsweredBefore);

    // update answer
    let (_, _index) = question.answerers.index_of(&tx_context::sender(ctx));
    let answer = vector::borrow_mut(&mut question.answers, _index);
    answer.answer_content = new_content;
    answer.images = new_images;
    answer.time = clock.timestamp_ms();

    event::emit(AnswerUpdated {
        question_id: question.id.to_address().to_id(),
        asker: question.asker,
        answerer: tx_context::sender(ctx),
        bounty: question.bounty_amount,
    });
}

//handle expired question
//users can still see them, but they won't be able to answer the question
//anyone can call this function as long as the question is expired
//bounty distribution depends on who calls this function
#[allow(lint(self_transfer))]
public fun handle_expired_question(question: &mut Question, clock: &Clock, ctx: &mut TxContext) {
    // make sure have expired
    assert!(question.end_time < clock::timestamp_ms(clock), ENotExpired);
    // make sure haven't been solved
    assert!(!question.answered, EHaveBeenSolved);

    let caller = tx_context::sender(ctx);
    let is_asker = caller == question.asker;
    let is_answerer = vector::contains(&question.answerers, &caller);

    let mut coin = dof::remove<vector<u8>, Coin<SUI>>(&mut question.id, Bounty);
    let total_amount = coin::value(&coin);

    if (!vector::is_empty(&question.answerers)) {
        let answerer_count = vector::length(&question.answerers);

        // 10% of bounty for the caller(neither asker nor answerer)
        let mut _caller_reward = 0;
        if (!is_asker && !is_answerer) {
            _caller_reward = total_amount / 10;
            let reward = coin::split(&mut coin, _caller_reward, ctx);
            transfer::public_transfer(reward, caller);
        };

        let remaining = coin::value(&coin);
        let per_answerer = remaining / answerer_count;

        let mut i = 0;
        while (i < answerer_count - 1) {
            let answerer = *vector::borrow(&question.answerers, i);
            let reward = coin::split(&mut coin, per_answerer, ctx);
            transfer::public_transfer(reward, answerer);
            i = i + 1;
        };
        transfer::public_transfer(coin, question.answerers[i]);
    } else {
        // if no answerer, transfer all bounty back to asker
        transfer::public_transfer(coin, question.asker);
    };

    question.answered = true;

    event::emit(QuestionExpired {
        question_id: question.id.to_address().to_id(),
        asker: question.asker,
        bounty: question.bounty_amount,
    });
}

//add comment to a answer
//can only comment once
public fun add_comment(
    question_information: &mut QuestionsInformation,
    question: &mut Question,
    answerer_to_comment: address,
    comment_content: vector<u8>,
    images: Option<vector<vector<u8>>>,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    // Make sure question hasn't expired
    assert!(question.end_time >= clock::timestamp_ms(clock), EHaveExpired);
    // Make sure question hasn't been answered (marked as solved)
    assert!(!question.answered, EHaveBeenSolved);

    // Get the answer index by the answerer's address
    let (found, answer_index) = vector::index_of(&question.answerers, &answerer_to_comment);
    assert!(found, ENotValidAnswerer);

    // Create the comment
    let comment = AnswerComment {
        id: object::new(ctx),
        answerer: tx_context::sender(ctx),
        answer_content: comment_content,
        images,
        time: clock.timestamp_ms(),
    };

    // Add comment to the answer
    let answer = vector::borrow_mut(&mut question.answers, answer_index);
    //make sure haven't added answer or comment to this question
    assert!(!answer.extra_answerers.contains(&tx_context::sender(ctx)), EHaveAnsweredBefore);

    vector::push_back(&mut answer.extra_answerers, tx_context::sender(ctx));
    vector::push_back(&mut answer.extra_content, comment);

    //update the index
    if (!question_information.commenters.contains(&tx_context::sender(ctx))) {
        question_information.commenters.push_back(tx_context::sender(ctx));
        question_information.comment_to_questions.push_back(vector::empty());
        question_information.comment_to_answers.push_back(vector::empty());
    };
    let (_, _index) = question_information.commenters.index_of(&tx_context::sender(ctx));
    question_information.comment_to_questions[_index].push_back(question.id.to_address().to_id());
    question_information.comment_to_answers[_index].push_back(answer.id.to_address().to_id());

    event::emit(CommentAdded {
        question_id: question.id.to_address().to_id(),
        asker: question.asker,
        answerer: answerer_to_comment,
        commenter: tx_context::sender(ctx),
        bounty: question.bounty_amount,
    });
}

//edit the comment
public fun edit_comment(
    question: &mut Question,
    answerer_to_comment: address,
    new_content: vector<u8>,
    new_images: Option<vector<vector<u8>>>,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    //make sure haven't expired or solved
    assert!(question.end_time >= clock::timestamp_ms(clock), EHaveExpired);
    assert!(!question.answered, EHaveBeenSolved);

    let (found, answer_index) = vector::index_of(&question.answerers, &answerer_to_comment);
    assert!(found, ENotValidAnswerer);

    let answer = vector::borrow_mut(&mut question.answers, answer_index);

    // make sure have commented before
    assert!(
        vector::contains(&answer.extra_answerers, &tx_context::sender(ctx)),
        EHaveNotAnsweredBefore,
    );

    // find the comment before
    let (_, _index) = answer.extra_answerers.index_of(&tx_context::sender(ctx));
    answer.extra_content[_index].answer_content = new_content;
    answer.extra_content[_index].images = new_images;
    answer.extra_content[_index].time = clock.timestamp_ms();

    event::emit(CommentUpdated {
        question_id: question.id.to_address().to_id(),
        asker: question.asker,
        answerer: answerer_to_comment,
        commenter: tx_context::sender(ctx),
        bounty: question.bounty_amount,
    });
}
