import React, { ChangeEvent, useEffect, useState } from "react";
import { BehaviorSubject, combineLatest, ObservedValueOf } from "rxjs";
import { map, concatMapTo, multicast } from "rxjs/operators";
type TodoItem = { id: number; text: string; isComplete: boolean };

const useBehaviorSubjectGetter = <T extends any>(
  behaviorSubject: BehaviorSubject<T>
) => {
  const [value, setValue] = useState<T>(behaviorSubject.value);
  useEffect(() => {
    const sub = behaviorSubject.subscribe((value) => setValue(value));
    return () => sub.unsubscribe();
  }, [behaviorSubject]);
  return value;
};

const useBehaviorSubjectSetter = <T extends any>(
  behaviorSubject: BehaviorSubject<T>
) => {
  function setter(value: T | ((prevValue: T) => T)) {
    if (typeof value === "function") {
      // @ts-ignore
      behaviorSubject.next(value(behaviorSubject.value));
    } else {
      behaviorSubject.next(value);
    }
  }
  return setter;
};

const useBehaviorSubject = <T extends any>(
  behaviorSubject: BehaviorSubject<T>
) => {
  const [value, setValue] = useState<T>(behaviorSubject.value);
  useEffect(() => {
    const sub = behaviorSubject.subscribe((value) => setValue(value));
    return () => sub.unsubscribe();
  }, [behaviorSubject]);
  return [
    useBehaviorSubjectGetter(behaviorSubject),
    useBehaviorSubjectSetter(behaviorSubject),
  ] as const;
};

const todoListState = new BehaviorSubject<TodoItem[]>([]);

const todoListFilterState = new BehaviorSubject<
  "Show All" | "Show Completed" | "Show Uncompleted"
>("Show All");

const _filteredTodoListState = combineLatest([
  todoListFilterState,
  todoListState,
]).pipe(
  map(([filter, list]) => {
    switch (filter) {
      case "Show Completed":
        return list.filter((item) => item.isComplete);
      case "Show Uncompleted":
        return list.filter((item) => !item.isComplete);
      default:
        return list;
    }
  })
);

const filteredTodoListState = new BehaviorSubject<TodoItem[]>([]);
_filteredTodoListState.subscribe((ls) => filteredTodoListState.next(ls));

const _todoListStatsState = todoListState.pipe(
  map(todoList => {
    const totalNum = todoList.length;
    const totalCompletedNum = todoList.filter((item) => item.isComplete).length;
    const totalUncompletedNum = totalNum - totalCompletedNum;
    const percentCompleted = totalNum === 0 ? 0 : totalCompletedNum / totalNum * 100;

    return {
      totalNum,
      totalCompletedNum,
      totalUncompletedNum,
      percentCompleted,
    };
  })
)
const todoListStatsState = new BehaviorSubject<ObservedValueOf<typeof _todoListStatsState>>(null!);
_todoListStatsState.subscribe(v => todoListStatsState.next(v))

function TodoListStats() {
  const {
    totalNum,
    totalCompletedNum,
    totalUncompletedNum,
    percentCompleted,
  } = useBehaviorSubjectGetter(todoListStatsState);

  const formattedPercentCompleted = Math.round(percentCompleted);

  return (
    <ul>
      <li>Total items: {totalNum}</li>
      <li>Items completed: {totalCompletedNum}</li>
      <li>Items not completed: {totalUncompletedNum}</li>
      <li>Percent completed: {formattedPercentCompleted}</li>
    </ul>
  );
}

function TodoItemCreator() {
  const [inputValue, setInputValue] = useState("");
  const setTodoList = useBehaviorSubjectSetter(todoListState);

  const addItem = () => {
    setTodoList((oldTodoList) => [
      ...oldTodoList,
      {
        id: getId(),
        text: inputValue,
        isComplete: false,
      },
    ]);
    setInputValue("");
  };

  const onChange = ({ target: { value } }: ChangeEvent<HTMLInputElement>) => {
    setInputValue(value);
  };

  return (
    <div>
      <input type="text" value={inputValue} onChange={onChange} />
      <button onClick={addItem}>Add</button>
    </div>
  );
}

function TodoItem({ item }: { item: TodoItem }) {
  const [todoList, setTodoList] = useBehaviorSubject(todoListState);
  const index = todoList.findIndex((listItem) => listItem === item);

  const editItemText = ({ target: { value } }: { target: any }) => {
    const newList = replaceItemAtIndex(todoList, index, {
      ...item,
      text: value,
    });

    setTodoList(newList);
  };

  const toggleItemCompletion = () => {
    const newList = replaceItemAtIndex(todoList, index, {
      ...item,
      isComplete: !item.isComplete,
    });
    console.log(newList, newList.length);
    setTodoList(newList);
  };

  const deleteItem = () => {
    const newList = removeItemAtIndex(todoList, index);

    setTodoList(newList);
  };

  return (
    <div>
      <input type="text" value={item.text} onChange={editItemText} />
      <input
        type="checkbox"
        checked={item.isComplete}
        onChange={toggleItemCompletion}
      />
      <button onClick={deleteItem}>X</button>
    </div>
  );
}

function replaceItemAtIndex<T>(arr: T[], index: number, newValue: T) {
  return [...arr.slice(0, index), newValue, ...arr.slice(index + 1)];
}

function removeItemAtIndex<T>(arr: T[], index: number) {
  return [...arr.slice(0, index), ...arr.slice(index + 1)];
}

function TodoListFilters() {
  const [filter, setFilter] = useBehaviorSubject(todoListFilterState);

  const updateFilter = ({
    target: { value },
  }: ChangeEvent<HTMLSelectElement>) => {
    setFilter(value as any);
  };

  return (
    <>
      Filter:
      <select value={filter} onChange={updateFilter}>
        <option value="Show All">All</option>
        <option value="Show Completed">Completed</option>
        <option value="Show Uncompleted">Uncompleted</option>
      </select>
    </>
  );
}
function App() {
  const todoList = useBehaviorSubjectGetter(filteredTodoListState);

  return (
    <>
      <TodoListStats />
      <TodoListFilters />
      <TodoItemCreator />

      {todoList.map((todoItem) => (
        <TodoItem key={todoItem.id} item={todoItem} />
      ))}
    </>
  );
}

// utility for creating unique Id
let id = 0;
function getId() {
  return id++;
}

export default App;
